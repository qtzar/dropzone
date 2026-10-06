import { range } from '../../core/rng';
import type { GameState, Enemy } from '../state';
import { emit } from '../events';
import { findMan, findEnemy } from '../query';
import { createEnemy, convertEnemy, killPoints } from '../entities/enemies';
import { laserHitsCircle, circlesOverlap } from './collision';
import { registerKill, resetCombo } from './scoring';
import { releaseTrailers, trailerHeadHit } from './ai/spawners';
import {
  HITSTOP_MULTI, HITSTOP_HUNTER, PLAYER_RADIUS, MAN_RADIUS, TRAIL_RADIUS, RESPAWN_DELAY,
} from '../constants';

const SHOT_RADIUS = 3;
const ORB_FRAGMENTS = 3;

export function killEnemy(s: GameState, e: Enemy): void {
  if (e.dead) return;
  e.dead = true;

  if (e.carryingId !== null) {
    const m = findMan(s, e.carryingId);
    if (m && m.state === 'snatched') {
      m.state = 'falling';
      m.holderId = null;
      m.vy = 0;
      m.fallStartY = m.y;
    }
    e.carryingId = null;
  }

  if (e.kind === 'planter' && e.linkedId !== null) {
    // Killed while lowering: its Android drops.
    const android = findEnemy(s, e.linkedId);
    if (android && android.linkedId === e.id) {
      android.linkedId = null;
      android.falling = true;
      android.vy = 0;
    }
  }

  if (e.kind === 'android') {
    if (e.linkedId !== null) {
      const planter = findEnemy(s, e.linkedId);
      if (planter && planter.linkedId === e.id) convertEnemy(s, planter, 'nemesite');
    }
    if (e.targetId !== null) {
      const m = findMan(s, e.targetId);
      if (m && m.state === 'chased' && m.holderId === e.id) {
        m.state = 'walking';
        m.holderId = null;
      }
    }
  }

  if (e.kind === 'spore') releaseTrailers(s, e);

  if (e.kind === 'orb') {
    for (let i = 0; i < ORB_FRAGMENTS; i++) {
      const a = (i / ORB_FRAGMENTS) * Math.PI * 2 + range(s.rng, 0, 0.5);
      const f = createEnemy(s, 'fragment', e.x, e.y);
      f.vx = Math.cos(a) * f.speed;
      f.vy = Math.sin(a) * f.speed;
      s.enemies.push(f);
    }
  }

  registerKill(s, killPoints(e), e.x, e.y);
  const big = e.kind === 'hunter' || e.kind === 'orb' || e.kind === 'nmeye';
  emit(s, { type: 'explosion', x: e.x, y: e.y, source: e.kind, big });
  if (e.kind === 'hunter' || e.kind === 'nmeye') s.hitStop = Math.max(s.hitStop, HITSTOP_HUNTER);
}

export function resolveLaserHits(s: GameState): void {
  let kills = 0;
  for (const l of s.lasers) {
    if (l.life <= 0) continue;
    for (const e of s.enemies) {
      if (e.dead) continue;
      if (laserHitsCircle(l, e.x, e.y, e.radius)) {
        l.life = 0;
        if (e.kind === 'trailer' && !trailerHeadHit(l, e)) {
          // Tail hit: the laser is absorbed and the Trailer survives.
          emit(s, { type: 'laserBlocked', x: e.x, y: e.y });
          break;
        }
        killEnemy(s, e);
        kills++;
        break;
      }
    }
  }
  if (kills >= 2) s.hitStop = Math.max(s.hitStop, HITSTOP_MULTI);
}

export function killPlayer(s: GameState): void {
  const p = s.player;
  if (!p.alive) return;
  p.alive = false;
  p.respawnTimer = RESPAWN_DELAY;
  p.cloakActive = false;
  p.vx = 0;
  p.vy = 0;
  if (p.carryingId !== null) {
    const m = findMan(s, p.carryingId);
    if (m && m.state === 'carried') {
      m.state = 'falling';
      m.vy = 0;
      m.fallStartY = m.y;
    }
    p.carryingId = null;
  }
  resetCombo(s);
  s.lives -= 1;
  emit(s, { type: 'playerDied', x: p.x, y: p.y });
  emit(s, { type: 'explosion', x: p.x, y: p.y, source: 'player', big: true });
  if (s.lives <= 0) {
    s.lives = 0;
    s.phase = 'gameOver';
    emit(s, { type: 'gameOver', score: s.score });
  }
}

/** True if any hazard (enemy, enemy shot, trail) overlaps the circle. Consumes a shot that hits. */
function hitByHazard(s: GameState, x: number, y: number, r: number): boolean {
  for (const e of s.enemies) {
    if (!e.dead && circlesOverlap(x, y, r, e.x, e.y, e.radius)) return true;
  }
  for (const sh of s.shots) {
    if (sh.life > 0 && circlesOverlap(x, y, r, sh.x, sh.y, SHOT_RADIUS)) {
      sh.life = 0;
      return true;
    }
  }
  for (const t of s.trails) {
    if (circlesOverlap(x, y, r, t.x, t.y, TRAIL_RADIUS)) return true;
  }
  return false;
}

export function resolvePlayerHits(s: GameState): void {
  const p = s.player;
  if (!p.alive || p.invuln > 0 || p.cloakActive) return;

  if (p.carryingId !== null) {
    const m = findMan(s, p.carryingId);
    if (m && hitByHazard(s, m.x, m.y, MAN_RADIUS)) {
      m.state = 'dead';
      p.carryingId = null;
      emit(s, { type: 'manDied', x: m.x, y: m.y });
      emit(s, { type: 'explosion', x: m.x, y: m.y, source: 'man', big: false });
    }
  }

  if (hitByHazard(s, p.x, p.y, PLAYER_RADIUS * 0.8)) killPlayer(s);
}

export function pruneDead(s: GameState): void {
  s.enemies = s.enemies.filter((e) => !e.dead);
  s.lasers = s.lasers.filter((l) => l.life > 0);
  s.shots = s.shots.filter((sh) => sh.life > 0);
}
