import { wrapX, shortestDx } from '../../core/world';
import type { GameState } from '../state';
import { groundYAt } from '../terrain';
import { circlesOverlap } from './collision';
import { killPlayer } from './combat';
import {
  MAGMA_GRAVITY, ACID_RADIUS, BOLT_WIDTH, EYE_BOMB_RADIUS, PLAYER_RADIUS,
} from '../constants';

/** Moves magma, acid and Nmeye bombs, ages bolts, and drops anything that hit the ground or expired. */
export function updateHazards(s: GameState, dt: number): void {
  for (const m of s.magma) {
    m.vy += MAGMA_GRAVITY * dt;
    m.x = wrapX(m.x + m.vx * dt);
    m.y += m.vy * dt;
  }
  s.magma = s.magma.filter((m) => !(m.vy > 0 && m.y >= groundYAt(s.terrain, m.x)));

  for (const a of s.acid) a.y += a.vy * dt;
  s.acid = s.acid.filter((a) => a.y < groundYAt(s.terrain, a.x));

  for (const b of s.eyeBombs) b.y += b.vy * dt;
  s.eyeBombs = s.eyeBombs.filter((b) => b.y < groundYAt(s.terrain, b.x));

  for (const b of s.bolts) b.life -= dt;
  s.bolts = s.bolts.filter((b) => b.life > 0);
}

/** Kills the player if a hazard touches them. Magma, acid and bombs are used up by the hit; bolts are not. Men are immune. */
export function resolveHazardHits(s: GameState): void {
  const p = s.player;
  if (!p.alive || p.invuln > 0 || p.cloakActive) return;
  const r = PLAYER_RADIUS * 0.8;

  const magma = s.magma.findIndex((m) => circlesOverlap(p.x, p.y, r, m.x, m.y, m.r));
  if (magma >= 0) {
    s.magma.splice(magma, 1);
    killPlayer(s);
    return;
  }
  const acid = s.acid.findIndex((a) => circlesOverlap(p.x, p.y, r, a.x, a.y, ACID_RADIUS));
  if (acid >= 0) {
    s.acid.splice(acid, 1);
    killPlayer(s);
    return;
  }
  const bomb = s.eyeBombs.findIndex((b) => circlesOverlap(p.x, p.y, r, b.x, b.y, EYE_BOMB_RADIUS));
  if (bomb >= 0) {
    s.eyeBombs.splice(bomb, 1);
    killPlayer(s);
    return;
  }
  for (const b of s.bolts) {
    if (Math.abs(shortestDx(b.x, p.x)) <= BOLT_WIDTH / 2 + r && p.y + r >= b.top && p.y - r <= b.bottom) {
      killPlayer(s);
      return;
    }
  }
}

/** Removes every hazard (used when a wave starts). */
export function clearHazards(s: GameState): void {
  s.magma = [];
  s.acid = [];
  s.bolts = [];
  s.eyeBombs = [];
}

/** Removes magma, acid and Nmeye bombs within `range` horizontally of `cx` (smart bomb). */
export function clearHazardsNear(s: GameState, cx: number, range: number): void {
  const far = (x: number) => Math.abs(shortestDx(cx, x)) > range;
  s.magma = s.magma.filter((m) => far(m.x));
  s.acid = s.acid.filter((a) => far(a.x));
  s.eyeBombs = s.eyeBombs.filter((b) => far(b.x));
}
