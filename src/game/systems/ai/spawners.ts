import { clamp } from '../../../core/world';
import type { GameState, Enemy, Laser } from '../../state';
import { createEnemy } from '../../entities/enemies';
import { homeOnPlayer } from './common';
import { CEILING_Y, TRAILER_TURN_RATE, TRAILER_AMPLITUDE, SPORE_TRAILERS } from '../../constants';

const TRAILER_HOME_MIN = CEILING_Y + 90;
const TRAILER_HOME_MAX = 480;
const RELEASE_SPREAD = 60;

/** A dead Spore bursts into 4 Trailers flying out at 90° intervals (the four diagonals). */
export function releaseTrailers(s: GameState, spore: Enemy): Enemy[] {
  const out: Enemy[] = [];
  for (let i = 0; i < SPORE_TRAILERS; i++) {
    const a = Math.PI / 4 + (i * Math.PI * 2) / SPORE_TRAILERS;
    const t = createEnemy(s, 'trailer', spore.x, spore.y);
    t.vx = Math.sign(Math.cos(a)) * t.speed;
    t.vy = Math.sin(a) * t.speed;
    t.homeY = clamp(spore.y + Math.sin(a) * RELEASE_SPREAD, TRAILER_HOME_MIN, TRAILER_HOME_MAX);
    s.enemies.push(t);
    out.push(t);
  }
  return out;
}

/** Homers steer at the player; the rest weave along their home line. Trailers leave no hazard trail. */
export function updateTrailer(s: GameState, e: Enemy, dt: number): void {
  if (e.homer) {
    homeOnPlayer(s, e, dt, TRAILER_TURN_RATE);
    return;
  }
  e.vx = Math.sign(e.vx || 1) * e.speed;
  const targetY = e.homeY + Math.sin(e.phase * 2.5) * TRAILER_AMPLITUDE;
  e.vy = (targetY - e.y) * 6;
}

/**
 * Head-hit rule: a horizontal laser strikes the side of the Trailer facing the laser's origin.
 * That is the front half when the Trailer is flying toward the laser (or has no horizontal speed).
 */
export function trailerHeadHit(l: Laser, e: Enemy): boolean {
  return Math.sign(l.vx) * e.vx <= 0;
}
