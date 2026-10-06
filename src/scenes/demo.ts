import { NO_ACTIONS, type Actions } from '../core/input';
import { shortestDx, clamp } from '../core/world';
import type { GameState, Enemy } from '../game/state';

const STANDOFF = 300;
const FIRE_RANGE = 700;
const ALIGN_TOLERANCE = 30;

/** Simple attract-mode pilot: chase the nearest enemy, line up vertically, and shoot. */
export function demoActions(s: GameState): Actions {
  const p = s.player;
  if (!p.alive) return NO_ACTIONS;

  let target: Enemy | undefined;
  let best = Infinity;
  for (const e of s.enemies) {
    if (e.dead) continue;
    const d = Math.abs(shortestDx(p.x, e.x)) + Math.abs(e.y - p.y) * 0.5;
    if (d < best) {
      best = d;
      target = e;
    }
  }
  if (!target) return NO_ACTIONS;

  const dx = shortestDx(p.x, target.x);
  const dy = target.y - p.y;
  const dir = Math.sign(dx) || 1;
  // Far away: full thrust toward it. Close: creep toward it so we keep facing it.
  const moveX = Math.abs(dx) > STANDOFF ? dir : dir * 0.15;
  const moveY = clamp(dy / 80, -1, 1);
  const fire = dir === p.facing && Math.abs(dy) < ALIGN_TOLERANCE && Math.abs(dx) < FIRE_RANGE;
  return { ...NO_ACTIONS, moveX, moveY, fire };
}
