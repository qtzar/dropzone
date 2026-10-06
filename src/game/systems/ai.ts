import { wrapX, shortestDx } from '../../core/world';
import type { GameState, Enemy, Man } from '../state';
import { emit } from '../events';
import { groundYAt } from '../terrain';
import { findMan } from '../query';
import { convertEnemy, resetFireTimer } from '../entities/enemies';
import {
  CEILING_Y, SNATCH_CARRY_OFFSET, TRAIL_LIFE, TRAIL_INTERVAL,
  ENEMY_SHOT_SPEED, ENEMY_SHOT_LIFE, ENEMY_FIRE_RANGE,
} from '../constants';

const SNATCHER_SEEK_RANGE = 2500;
const GRAB_DISTANCE = 10;
const TRAILER_AMPLITUDE = 80;

function playerVisible(s: GameState): boolean {
  return s.player.alive && !s.player.cloakActive;
}

function pickTarget(s: GameState, e: Enemy): Man | undefined {
  const claimed = new Set<number>();
  for (const o of s.enemies) if (o !== e && !o.dead && o.targetId !== null) claimed.add(o.targetId);
  let best: Man | undefined;
  let bestD = SNATCHER_SEEK_RANGE;
  for (const m of s.men) {
    if (m.state !== 'walking' || claimed.has(m.id)) continue;
    const d = Math.abs(shortestDx(e.x, m.x));
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

function updateSnatcher(s: GameState, e: Enemy): void {
  if (e.carryingId !== null) {
    const man = findMan(s, e.carryingId);
    if (!man || man.state !== 'snatched') {
      e.carryingId = null;
      return;
    }
    if (e.y <= CEILING_Y + 1) {
      man.state = 'dead';
      man.holderId = null;
      emit(s, { type: 'manDied', x: man.x, y: man.y });
      convertEnemy(s, e, 'nemesite');
      return;
    }
    e.vx = 0;
    e.vy = -e.speed * 0.8;
    return;
  }

  let target = e.targetId !== null ? findMan(s, e.targetId) : undefined;
  if (!target || target.state !== 'walking') {
    target = pickTarget(s, e);
    e.targetId = target ? target.id : null;
  }
  if (!target) {
    e.vx = Math.cos(e.phase * 0.7) * e.speed;
    e.vy = (e.homeY - e.y) * 0.5 + Math.sin(e.phase * 1.3) * e.speed * 0.3;
    return;
  }

  const dx = shortestDx(e.x, target.x);
  const dy = target.y - SNATCH_CARRY_OFFSET - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist < GRAB_DISTANCE) {
    target.state = 'snatched';
    target.holderId = e.id;
    e.carryingId = target.id;
    e.targetId = null;
    e.vx = 0;
    e.vy = 0;
    emit(s, { type: 'manSnatched', x: target.x, y: target.y });
    return;
  }
  e.vx = (dx / dist) * e.speed;
  e.vy = (dy / dist) * e.speed;
}

function updateHomer(s: GameState, e: Enemy, dt: number, turnRate: number): void {
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

function updateTrailer(s: GameState, e: Enemy, dt: number): void {
  e.vx = Math.sign(e.vx || 1) * e.speed;
  const targetY = e.homeY + Math.sin(e.phase * 2.5) * TRAILER_AMPLITUDE;
  e.vy = (targetY - e.y) * 6;
  e.trailTimer -= dt;
  if (e.trailTimer <= 0) {
    s.trails.push({ x: e.x, y: e.y, life: TRAIL_LIFE });
    e.trailTimer = TRAIL_INTERVAL;
  }
}

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

export function updateEnemies(s: GameState, dt: number): void {
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.phase += dt;
    switch (e.kind) {
      case 'snatcher':
        updateSnatcher(s, e);
        break;
      case 'nemesite':
        updateHomer(s, e, dt, 2);
        break;
      case 'hunter':
        updateHomer(s, e, dt, 4);
        break;
      case 'trailer':
        updateTrailer(s, e, dt);
        break;
      case 'orb':
      case 'fragment':
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

export function updateTrails(s: GameState, dt: number): void {
  for (const t of s.trails) t.life -= dt;
  s.trails = s.trails.filter((t) => t.life > 0);
}
