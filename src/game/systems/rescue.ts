import { WORLD_W, wrapX, shortestDx } from '../../core/world';
import { range, chance } from '../../core/rng';
import { allocId, type GameState, type Man } from '../state';
import { emit } from '../events';
import { groundYAt, BASE_GROUND_Y } from '../terrain';
import { findEnemy } from '../query';
import { makeAggressive } from '../entities/enemies';
import { circlesOverlap } from './collision';
import { awardBonus } from './scoring';
import {
  MAN_RADIUS, MAN_WALK_SPEED, MAN_FALL_GRAVITY, MAN_SAFE_FALL, MAN_CARRY_OFFSET, SNATCH_CARRY_OFFSET,
  PLAYER_RADIUS, RESCUE_POINTS, CATCH_POINTS, BASE_WIDTH, BASE_DELIVERY_HEIGHT,
} from '../constants';

const CATCH_SLOP = 4;

export function spawnMen(s: GameState, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = wrapX((i + 0.5) * (WORLD_W / count) + range(s.rng, -200, 200));
    s.men.push({
      id: allocId(s),
      x,
      y: groundYAt(s.terrain, x) - MAN_RADIUS,
      vy: 0,
      dir: chance(s.rng, 0.5) ? 1 : -1,
      state: 'walking',
      fallStartY: 0,
      holderId: null,
      walkTimer: range(s.rng, 2, 5),
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

function walk(s: GameState, m: Man, dt: number): void {
  m.walkTimer -= dt;
  if (m.walkTimer <= 0) {
    m.dir = chance(s.rng, 0.5) ? 1 : -1;
    m.walkTimer = range(s.rng, 2, 5);
  }
  m.x = wrapX(m.x + m.dir * MAN_WALK_SPEED * dt);
  m.y = groundYAt(s.terrain, m.x) - MAN_RADIUS;
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
    awardBonus(s, RESCUE_POINTS, m.x, m.y);
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
    if (ground - m.fallStartY > MAN_SAFE_FALL) {
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

export function checkCritical(s: GameState): void {
  if (s.critical || s.men.length === 0) return;
  if (!s.men.every((m) => m.state === 'dead')) return;
  s.critical = true;
  s.menRemaining = 0;
  for (const e of s.enemies) if (!e.dead) makeAggressive(s, e);
  emit(s, { type: 'planetCritical' });
}
