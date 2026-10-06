import { shortestDx } from '../../../core/world';
import type { GameState, Enemy } from '../../state';

/** Enemies only see the player while alive and uncloaked. */
export function playerVisible(s: GameState): boolean {
  return s.player.alive && !s.player.cloakActive;
}

/** Steers the enemy's velocity toward the player at its speed; drifts when the player is hidden. */
export function homeOnPlayer(s: GameState, e: Enemy, dt: number, turnRate: number): void {
  if (!playerVisible(s)) {
    e.vx *= 0.99;
    e.vy = Math.sin(e.phase) * 40;
    return;
  }
  const dx = shortestDx(e.x, s.player.x);
  const dy = s.player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, dt * turnRate);
  e.vx += ((dx / d) * e.speed - e.vx) * k;
  e.vy += ((dy / d) * e.speed - e.vy) * k;
}
