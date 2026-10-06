import { wrapX, shortestDx } from '../../../core/world';
import { range } from '../../../core/rng';
import type { GameState, Enemy, Laser } from '../../state';
import { emit } from '../../events';
import { playerVisible, homeOnPlayer } from './common';
import {
  NEMESITE_TURN_RATE, NEMESITE_COMMIT_RANGE, NEMESITE_DODGE_BAND, NEMESITE_DODGE_SPEED, NEMESITE_DODGE_TIME,
  NEMESITE_WARN_RANGE, NMEYE_TURN_MIN, NMEYE_TURN_MAX, NMEYE_WOBBLE, NMEYE_BOMB_INTERVAL, EYE_BOMB_SPEED,
  ANTIMATTER_ORBIT_RADIUS, ANTIMATTER_DRIFT, ANTIMATTER_SPIN,
} from '../../constants';

/** A player laser flying toward the Nemesite, level with it, and still far enough away to dodge. */
function threateningLaser(s: GameState, e: Enemy): Laser | undefined {
  for (const l of s.lasers) {
    if (l.life <= 0) continue;
    const dx = shortestDx(l.x, e.x);
    if (Math.sign(dx) !== Math.sign(l.vx)) continue;
    if (Math.abs(dx) <= NEMESITE_COMMIT_RANGE) continue;
    if (Math.abs(l.y - e.y) > NEMESITE_DODGE_BAND) continue;
    return l;
  }
  return undefined;
}

export function updateNemesite(s: GameState, e: Enemy, dt: number): void {
  const p = s.player;
  if (!e.warned && p.alive && Math.hypot(shortestDx(e.x, p.x), p.y - e.y) <= NEMESITE_WARN_RANGE) {
    e.warned = true;
    emit(s, { type: 'nemesiteWarning', x: e.x, y: e.y });
  }
  if (e.dodgeTimer > 0) {
    e.dodgeTimer = Math.max(0, e.dodgeTimer - dt);
    e.vy = e.dodgeDir * NEMESITE_DODGE_SPEED;
    return;
  }
  homeOnPlayer(s, e, dt, NEMESITE_TURN_RATE);
  const l = threateningLaser(s, e);
  if (l) {
    e.dodgeDir = e.y < l.y ? -1 : 1;
    e.dodgeTimer = NEMESITE_DODGE_TIME;
    e.vy = e.dodgeDir * NEMESITE_DODGE_SPEED;
  }
}

export function updateNmeye(s: GameState, e: Enemy, dt: number): void {
  e.actionTimer -= dt;
  if (e.actionTimer <= 0) {
    e.actionTimer = range(s.rng, NMEYE_TURN_MIN, NMEYE_TURN_MAX);
    const heading = playerVisible(s)
      ? Math.atan2(s.player.y - e.y, shortestDx(e.x, s.player.x)) + range(s.rng, -NMEYE_WOBBLE, NMEYE_WOBBLE)
      : range(s.rng, 0, Math.PI * 2);
    e.vx = Math.cos(heading) * e.speed;
    e.vy = Math.sin(heading) * e.speed;
  }
  e.bombTimer -= dt;
  if (e.bombTimer <= 0) {
    e.bombTimer += NMEYE_BOMB_INTERVAL;
    s.eyeBombs.push({ x: e.x, y: e.y + e.radius, vy: EYE_BOMB_SPEED });
  }
}

export function updateAntimatter(s: GameState, e: Enemy, dt: number): void {
  if (playerVisible(s)) {
    const dx = shortestDx(e.orbitX, s.player.x);
    const dy = s.player.y - e.orbitY;
    const d = Math.hypot(dx, dy);
    if (d > 0) {
      const step = Math.min(d, ANTIMATTER_DRIFT * dt);
      e.orbitX = wrapX(e.orbitX + (dx / d) * step);
      e.orbitY += (dy / d) * step;
    }
  }
  e.orbitAngle += ANTIMATTER_SPIN * dt;
  const tx = wrapX(e.orbitX + Math.cos(e.orbitAngle) * ANTIMATTER_ORBIT_RADIUS);
  const ty = e.orbitY + Math.sin(e.orbitAngle) * ANTIMATTER_ORBIT_RADIUS;
  // Velocity that lands exactly on the orbit point after integration.
  e.vx = shortestDx(e.x, tx) / dt;
  e.vy = (ty - e.y) / dt;
}
