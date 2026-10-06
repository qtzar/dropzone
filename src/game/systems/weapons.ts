import type { Actions } from '../../core/input';
import { wrapX } from '../../core/world';
import type { GameState } from '../state';
import { emit } from '../events';
import {
  FIRE_INTERVAL, HEAT_PER_SHOT, HEAT_COOL_RATE, OVERHEAT_UNLOCK, LASER_SPEED, LASER_LIFE,
} from '../constants';

export const LASER_MUZZLE_OFFSET = 18;

export function updateFiring(s: GameState, a: Actions, dt: number): void {
  const p = s.player;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.heat = Math.max(0, p.heat - HEAT_COOL_RATE * dt);
  if (p.overheated && p.heat < OVERHEAT_UNLOCK) p.overheated = false;

  if (!a.fire || !p.alive || p.overheated || p.fireCooldown > 0) return;

  const x = wrapX(p.x + p.facing * LASER_MUZZLE_OFFSET);
  const y = p.y - 1;
  s.lasers.push({ x, prevX: p.x, y, vx: p.facing * LASER_SPEED + p.vx, life: LASER_LIFE });
  p.fireCooldown = FIRE_INTERVAL;
  p.heat = Math.min(1, p.heat + HEAT_PER_SHOT);
  if (p.heat >= 1) p.overheated = true;
  emit(s, { type: 'laserFired', x, y, facing: p.facing });
}

export function updateLasers(s: GameState, dt: number): void {
  for (const l of s.lasers) {
    l.prevX = l.x;
    l.x = wrapX(l.x + l.vx * dt);
    l.life -= dt;
  }
  s.lasers = s.lasers.filter((l) => l.life > 0);
}
