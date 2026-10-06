import type { Actions } from '../../core/input';
import { VIEW_W, CAMERA_LEAD, WORLD_W, wrapX, shortestDx } from '../../core/world';
import type { GameState } from '../state';
import { emit } from '../events';
import { killEnemy } from './combat';
import { clearHazardsNear } from './hazards';
import { SHIELD_DRAIN, CEILING_Y, RESPAWN_INVULN, HITSTOP_MULTI } from '../constants';

export const RESPAWN_Y = CEILING_Y + 120;

/** The shield (cloak) is on while held, the player is alive and the bank has seconds left. */
export function updateCloak(s: GameState, a: Actions, dt: number): void {
  const p = s.player;
  const want = a.cloak && p.alive && s.shieldBank > 0;
  if (want !== p.cloakActive) emit(s, { type: want ? 'cloakOn' : 'cloakOff' });
  p.cloakActive = want;
  if (want) s.shieldBank = Math.max(0, s.shieldBank - SHIELD_DRAIN * dt);
}

/**
 * Strata Bomb: kills every enemy on the led screen except Androids, and clears enemy shots,
 * acid, magma and Nmeye bombs there. Trailers released by bombed Spores survive the blast.
 */
export function triggerBomb(s: GameState): boolean {
  const p = s.player;
  if (s.bombs <= 0 || !p.alive) return false;
  s.bombs--;
  const range = VIEW_W / 2;
  const cx = wrapX(p.x + p.facing * CAMERA_LEAD);
  const targets = s.enemies.filter(
    (e) => !e.dead && e.kind !== 'android' && Math.abs(shortestDx(cx, e.x)) <= range + e.radius,
  );
  for (const e of targets) killEnemy(s, e);
  s.shots = s.shots.filter((sh) => Math.abs(shortestDx(cx, sh.x)) > range);
  clearHazardsNear(s, cx, range);
  if (targets.length >= 2) s.hitStop = Math.max(s.hitStop, HITSTOP_MULTI);
  emit(s, { type: 'bombDetonated', x: p.x, y: p.y });
  return true;
}

/** Of 8 evenly spaced candidates, the one furthest from any living enemy (ties: lowest index). */
function pickRespawnX(s: GameState): number {
  let bestX = s.baseX;
  let bestMin = -1;
  for (let i = 0; i < 8; i++) {
    const x = wrapX(s.baseX + (i * WORLD_W) / 8);
    let min = Infinity;
    for (const e of s.enemies) {
      if (e.dead) continue;
      min = Math.min(min, Math.abs(shortestDx(x, e.x)));
    }
    if (min > bestMin) {
      bestMin = min;
      bestX = x;
    }
  }
  return bestX;
}

export function updateRespawn(s: GameState, dt: number): void {
  const p = s.player;
  if (p.alive || s.phase === 'gameOver') return;
  p.respawnTimer -= dt;
  if (p.respawnTimer > 0) return;
  p.x = pickRespawnX(s);
  p.alive = true;
  p.y = RESPAWN_Y;
  p.prevX = p.x;
  p.prevY = p.y;
  p.vx = 0;
  p.vy = 0;
  p.invuln = RESPAWN_INVULN;
  p.heat = 0;
  p.overheated = false;
  s.shots = s.shots.filter((sh) => Math.abs(shortestDx(p.x, sh.x)) > VIEW_W / 2);
  emit(s, { type: 'playerRespawned', x: p.x, y: p.y });
}
