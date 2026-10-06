import { WORLD_W, wrapX, shortestDx } from '../../core/world';
import { range, chance } from '../../core/rng';
import { allocId, type GameState, type Man } from '../state';
import { emit } from '../events';
import { groundYAt, BASE_GROUND_Y } from '../terrain';
import { isLake, isLava } from '../landscape';
import { findEnemy } from '../query';
import { convertEnemy, startOrbit } from '../entities/enemies';
import { circlesOverlap } from './collision';
import { awardBonus } from './scoring';
import {
  MAN_RADIUS, MAN_WALK_SPEED, MAN_FALL_GRAVITY, MAN_SAFE_FALL, MAN_CARRY_OFFSET, SNATCH_CARRY_OFFSET,
  PLAYER_RADIUS, RESCUE_POINTS_PER_WAVE, RESCUE_POINTS_CAP, CATCH_POINTS, BASE_WIDTH, BASE_DELIVERY_HEIGHT,
  MAN_TURN_MIN, MAN_TURN_MAX,
} from '../constants';

const CATCH_SLOP = 4;
/** Men never spawn closer than this to the base pad edge. */
const SPAWN_BASE_CLEAR = 200;
const SPAWN_HAZARD_CLEAR = 24;

/** Moves a spawn x off the base pad surroundings and out of the lake or a lava ditch. */
function safeSpawnX(s: GameState, x: number): number {
  const dBase = shortestDx(s.baseX, x);
  const minBase = BASE_WIDTH / 2 + SPAWN_BASE_CLEAR;
  if (Math.abs(dBase) < minBase) x = wrapX(s.baseX + (dBase < 0 ? -1 : 1) * minBase);
  for (let i = 0; i < 40 && (isLake(s.landscape, x) || isLava(s.landscape, x)); i++) {
    x = wrapX(x + SPAWN_HAZARD_CLEAR);
  }
  return x;
}

export function spawnMen(s: GameState, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = safeSpawnX(s, wrapX((i + 0.5) * (WORLD_W / count) + range(s.rng, -200, 200)));
    s.men.push({
      id: allocId(s),
      x,
      y: groundYAt(s.terrain, x) - MAN_RADIUS,
      vy: 0,
      dir: chance(s.rng, 0.5) ? 1 : -1,
      state: 'walking',
      fallStartY: 0,
      holderId: null,
      walkTimer: 0,
    });
  }
}

export function canDeliver(s: GameState): boolean {
  const p = s.player;
  return (
    p.alive &&
    Math.abs(shortestDx(p.x, s.baseX)) <= BASE_WIDTH / 2 &&
    p.y >= BASE_GROUND_Y - BASE_DELIVERY_HEIGHT
  );
}

function startFalling(m: Man): void {
  m.state = 'falling';
  m.holderId = null;
  m.vy = 0;
  m.fallStartY = m.y;
}

function blockedAt(s: GameState, x: number): boolean {
  return isLake(s.landscape, x) || isLava(s.landscape, x);
}

/**
 * Walks toward the base by the shortest wrapped direction. At the edge of the lake or a lava
 * ditch the man turns back and walks away for 1-2 s (walkTimer), then heads for the base again.
 */
function walk(s: GameState, m: Man, dt: number): void {
  if (m.walkTimer > 0) m.walkTimer = Math.max(0, m.walkTimer - dt);
  else m.dir = shortestDx(m.x, s.baseX) < 0 ? -1 : 1;
  const nx = wrapX(m.x + m.dir * MAN_WALK_SPEED * dt);
  if (blockedAt(s, nx) && !blockedAt(s, m.x)) {
    m.dir = m.dir === 1 ? -1 : 1;
    m.walkTimer = range(s.rng, MAN_TURN_MIN, MAN_TURN_MAX);
  } else {
    m.x = nx;
  }
  m.y = groundYAt(s.terrain, m.x) - MAN_RADIUS;
}

/** A man who walks onto the base pad rescues himself: a survivor, but no points. */
function checkSelfRescue(s: GameState, m: Man): boolean {
  if (Math.abs(shortestDx(m.x, s.baseX)) > BASE_WIDTH / 2) return false;
  m.state = 'saved';
  m.holderId = null;
  s.savedThisWave++;
  emit(s, { type: 'manSelfRescued', x: m.x, y: m.y });
  return true;
}

/** Carried delivery: 100 x wave, capped at 500 (the combo multiplier applies on top). */
export function rescuePoints(wave: number): number {
  return Math.min(RESCUE_POINTS_CAP, RESCUE_POINTS_PER_WAVE * Math.max(1, wave));
}

/** True while the Android recorded in holderId still exists and is chasing this man. */
function isChasedBy(s: GameState, m: Man): boolean {
  const a = m.holderId !== null ? findEnemy(s, m.holderId) : undefined;
  return a !== undefined && a.kind === 'android' && a.targetId === m.id;
}

function playerCanTake(s: GameState): boolean {
  return s.player.alive && s.player.carryingId === null;
}

function updateCarried(s: GameState, m: Man): void {
  const p = s.player;
  if (p.carryingId !== m.id) {
    startFalling(m);
    return;
  }
  m.x = p.x;
  m.y = Math.min(p.y + MAN_CARRY_OFFSET, groundYAt(s.terrain, p.x) - MAN_RADIUS);
  if (canDeliver(s)) {
    m.state = 'saved';
    p.carryingId = null;
    s.savedThisWave++;
    awardBonus(s, rescuePoints(s.wave), m.x, m.y);
    emit(s, { type: 'manRescued', x: m.x, y: m.y });
  }
}

function updateSnatched(s: GameState, m: Man): void {
  const holder = m.holderId !== null ? findEnemy(s, m.holderId) : undefined;
  if (!holder) {
    startFalling(m);
    return;
  }
  m.x = holder.x;
  m.y = holder.y + SNATCH_CARRY_OFFSET;
}

function updateFalling(s: GameState, m: Man, dt: number): void {
  const p = s.player;
  m.vy += MAN_FALL_GRAVITY * dt;
  m.y += m.vy * dt;

  if (playerCanTake(s) && circlesOverlap(p.x, p.y, PLAYER_RADIUS + CATCH_SLOP, m.x, m.y, MAN_RADIUS)) {
    m.state = 'carried';
    m.vy = 0;
    p.carryingId = m.id;
    awardBonus(s, CATCH_POINTS, m.x, m.y);
    emit(s, { type: 'manCaught', x: m.x, y: m.y });
    return;
  }

  const ground = groundYAt(s.terrain, m.x) - MAN_RADIUS;
  if (m.y >= ground) {
    m.y = ground;
    m.vy = 0;
    if (ground - m.fallStartY > MAN_SAFE_FALL || isLava(s.landscape, m.x)) {
      m.state = 'dead';
      emit(s, { type: 'manDied', x: m.x, y: m.y });
      emit(s, { type: 'explosion', x: m.x, y: m.y, source: 'man', big: false });
    } else {
      m.state = 'walking';
    }
  }
}

function updateWalking(s: GameState, m: Man, dt: number): void {
  const p = s.player;
  walk(s, m, dt);
  if (checkSelfRescue(s, m)) return;
  if (playerCanTake(s) && circlesOverlap(p.x, p.y, PLAYER_RADIUS, m.x, m.y, MAN_RADIUS)) {
    m.state = 'carried';
    m.holderId = null;
    p.carryingId = m.id;
    emit(s, { type: 'manPickedUp', x: m.x, y: m.y });
  }
}

export function updateMen(s: GameState, dt: number): void {
  for (const m of s.men) {
    switch (m.state) {
      case 'chased':
        // A chased man keeps walking (and can be picked up); he calms down once his Android is gone.
        if (!isChasedBy(s, m)) {
          m.state = 'walking';
          m.holderId = null;
        }
        updateWalking(s, m, dt);
        break;
      case 'walking':
        updateWalking(s, m, dt);
        break;
      case 'carried':
        updateCarried(s, m);
        break;
      case 'snatched':
        updateSnatched(s, m);
        break;
      case 'falling':
        updateFalling(s, m, dt);
        break;
      case 'saved':
      case 'dead':
        break;
    }
  }
}

/** Planet unstable: the wave had men and every one of them is dead. */
export function checkUnstable(s: GameState): void {
  if (s.unstable || s.men.length === 0) return;
  if (!s.men.every((m) => m.state === 'dead')) return;
  s.unstable = true;
  s.menRemaining = 0;
  for (const e of s.enemies) {
    if (e.dead || (e.kind !== 'planter' && e.kind !== 'android')) continue;
    convertEnemy(s, e, 'antimatter');
    startOrbit(e);
  }
  emit(s, { type: 'planetUnstable' });
}
