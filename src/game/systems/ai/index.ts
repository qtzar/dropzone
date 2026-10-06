import { wrapX, shortestDx } from '../../../core/world';
import type { GameState, Enemy } from '../../state';
import { emit } from '../../events';
import { groundYAt } from '../../terrain';
import { resetFireTimer } from '../../entities/enemies';
import { CEILING_Y, ENEMY_SHOT_SPEED, ENEMY_SHOT_LIFE, ENEMY_FIRE_RANGE } from '../../constants';
import { playerVisible } from './common';
import { updatePlanter, updateAndroid } from './planter';
import { updateNemesite, updateNmeye, updateAntimatter } from './homers';
import { updateTrailer } from './spawners';
import { updateBlunderstorm } from './storm';

function integrate(s: GameState, e: Enemy, dt: number): void {
  e.x = wrapX(e.x + e.vx * dt);
  e.y += e.vy * dt;
  if (e.y < CEILING_Y) {
    e.y = CEILING_Y;
    if (e.vy < 0) e.vy = -e.vy;
  }
  const floor = groundYAt(s.terrain, e.x) - e.radius;
  if (e.y > floor) {
    e.y = floor;
    if (e.vy > 0) e.vy = -e.vy;
  }
}

function fireAtPlayer(s: GameState, e: Enemy): void {
  const p = s.player;
  const dx = shortestDx(e.x, p.x);
  const dy = p.y - e.y;
  const t = Math.hypot(dx, dy) / ENEMY_SHOT_SPEED;
  const ax = dx + p.vx * t * 0.5;
  const ay = dy + p.vy * t * 0.5;
  const d = Math.hypot(ax, ay) || 1;
  s.shots.push({
    x: e.x,
    y: e.y,
    vx: (ax / d) * ENEMY_SHOT_SPEED,
    vy: (ay / d) * ENEMY_SHOT_SPEED,
    life: ENEMY_SHOT_LIFE,
  });
  emit(s, { type: 'enemyShot', x: e.x, y: e.y });
}

function updateEnemyFire(s: GameState, e: Enemy, dt: number): void {
  if (e.fireTimer === Infinity) return;
  e.fireTimer -= dt;
  if (e.fireTimer > 0) return;
  resetFireTimer(s, e);
  if (!playerVisible(s)) return;
  if (Math.abs(shortestDx(e.x, s.player.x)) > ENEMY_FIRE_RANGE) return;
  fireAtPlayer(s, e);
}

/** Runs each living enemy's behaviour, then moves it and lets it shoot. */
export function updateEnemies(s: GameState, dt: number): void {
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.phase += dt;
    switch (e.kind) {
      case 'planter':
        updatePlanter(s, e, dt);
        break;
      case 'android':
        updateAndroid(s, e, dt);
        break;
      case 'nemesite':
        updateNemesite(s, e, dt);
        break;
      case 'trailer':
        updateTrailer(s, e, dt);
        break;
      case 'blunderstorm':
        updateBlunderstorm(s, e, dt);
        break;
      case 'nmeye':
        updateNmeye(s, e, dt);
        break;
      case 'antimatter':
        updateAntimatter(s, e, dt);
        break;
      case 'spore':
        break;
    }
    integrate(s, e, dt);
    updateEnemyFire(s, e, dt);
  }
}

export function updateShots(s: GameState, dt: number): void {
  for (const sh of s.shots) {
    sh.x = wrapX(sh.x + sh.vx * dt);
    sh.y += sh.vy * dt;
    sh.life -= dt;
    if (sh.y < CEILING_Y || sh.y > groundYAt(s.terrain, sh.x)) sh.life = 0;
  }
  s.shots = s.shots.filter((sh) => sh.life > 0);
}
