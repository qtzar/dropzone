import type { Actions } from '../../core/input';
import { wrapX, clamp } from '../../core/world';
import type { GameState } from '../state';
import { groundYAt } from '../terrain';
import {
  PLAYER_THRUST, PLAYER_DRAG, PLAYER_GRAVITY, PLAYER_MAX_VX, PLAYER_MAX_VY, PLAYER_RADIUS, CEILING_Y,
} from '../constants';

export function updatePlayerMovement(s: GameState, a: Actions, dt: number): void {
  const p = s.player;
  p.prevX = p.x;
  p.prevY = p.y;
  if (!p.alive) return;

  if (a.moveX !== 0) p.facing = a.moveX > 0 ? 1 : -1;
  p.thrusting = a.moveX !== 0 || a.moveY < 0;

  p.vx += a.moveX * PLAYER_THRUST * dt;
  p.vy += (a.moveY * PLAYER_THRUST + PLAYER_GRAVITY) * dt;
  const damp = 1 / (1 + PLAYER_DRAG * dt);
  p.vx = clamp(p.vx * damp, -PLAYER_MAX_VX, PLAYER_MAX_VX);
  p.vy = clamp(p.vy * damp, -PLAYER_MAX_VY, PLAYER_MAX_VY);

  p.x = wrapX(p.x + p.vx * dt);
  p.y += p.vy * dt;

  const floor = groundYAt(s.terrain, p.x) - PLAYER_RADIUS;
  if (p.y > floor) {
    p.y = floor;
    if (p.vy > 0) p.vy = 0;
  }
  if (p.y < CEILING_Y) {
    p.y = CEILING_Y;
    if (p.vy < 0) p.vy = 0;
  }
}

export function updatePlayerTimers(s: GameState, dt: number): void {
  const p = s.player;
  p.invuln = Math.max(0, p.invuln - dt);
}
