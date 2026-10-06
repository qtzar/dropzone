import type { Actions } from '../../core/input';
import { VIEW_W, shortestDx } from '../../core/world';
import type { GameState } from '../state';
import { emit } from '../events';
import { killEnemy } from './combat';
import { CLOAK_DRAIN, CEILING_Y, RESPAWN_INVULN, HITSTOP_MULTI } from '../constants';

export const RESPAWN_Y = CEILING_Y + 120;

export function updateCloak(s: GameState, a: Actions, dt: number): void {
  const p = s.player;
  const want = a.cloak && p.alive && p.cloak > 0;
  if (want !== p.cloakActive) emit(s, { type: want ? 'cloakOn' : 'cloakOff' });
  p.cloakActive = want;
  if (want) p.cloak = Math.max(0, p.cloak - CLOAK_DRAIN * dt);
}

export function triggerBomb(s: GameState): boolean {
  const p = s.player;
  if (s.bombs <= 0 || !p.alive) return false;
  s.bombs--;
  const range = VIEW_W / 2;
  const targets = s.enemies.filter((e) => !e.dead && Math.abs(shortestDx(p.x, e.x)) <= range + e.radius);
  for (const e of targets) killEnemy(s, e);
  s.shots = s.shots.filter((sh) => Math.abs(shortestDx(p.x, sh.x)) > range);
  if (targets.length >= 2) s.hitStop = Math.max(s.hitStop, HITSTOP_MULTI);
  emit(s, { type: 'bombDetonated', x: p.x, y: p.y });
  return true;
}

export function updateRespawn(s: GameState, dt: number): void {
  const p = s.player;
  if (p.alive || s.phase === 'gameOver') return;
  p.respawnTimer -= dt;
  if (p.respawnTimer > 0) return;
  p.alive = true;
  p.y = RESPAWN_Y;
  p.prevX = p.x;
  p.prevY = p.y;
  p.vx = 0;
  p.vy = 0;
  p.invuln = RESPAWN_INVULN;
  p.heat = 0;
  p.overheated = false;
  emit(s, { type: 'playerRespawned', x: p.x, y: p.y });
}
