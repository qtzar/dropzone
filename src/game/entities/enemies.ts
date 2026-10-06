import { wrapX } from '../../core/world';
import { range, chance } from '../../core/rng';
import { allocId, type GameState, type Enemy, type EnemyKind } from '../state';

export interface EnemyStats {
  radius: number;
  points: number;
  speed: number;
  /** Multiplier on the wave's enemy fire interval; 0 = never fires. */
  fireMult: number;
}

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  snatcher: { radius: 14, points: 150, speed: 130, fireMult: 2 },
  nemesite: { radius: 13, points: 200, speed: 240, fireMult: 0.6 },
  trailer: { radius: 14, points: 250, speed: 200, fireMult: 1.5 },
  orb: { radius: 16, points: 100, speed: 60, fireMult: 0 },
  fragment: { radius: 7, points: 50, speed: 280, fireMult: 0 },
  hunter: { radius: 15, points: 500, speed: 400, fireMult: 0.5 },
};

export const AGGRESSIVE_SPEED_MULT = 1.3;
export const AGGRESSIVE_FIRE_MULT = 0.7;

export function fireInterval(s: GameState, e: Enemy): number {
  const m = ENEMY_STATS[e.kind].fireMult;
  if (m === 0) return Infinity;
  return s.enemyFireInterval * m * (e.aggressive ? AGGRESSIVE_FIRE_MULT : 1);
}

export function resetFireTimer(s: GameState, e: Enemy): void {
  const i = fireInterval(s, e);
  e.fireTimer = i === Infinity ? Infinity : i * range(s.rng, 0.7, 1.3);
}

function speedFor(s: GameState, kind: EnemyKind, aggressive: boolean): number {
  return ENEMY_STATS[kind].speed * s.speedScale * (aggressive ? AGGRESSIVE_SPEED_MULT : 1);
}

/** Creates an enemy. The caller is responsible for pushing it into s.enemies. */
export function createEnemy(s: GameState, kind: EnemyKind, x: number, y: number): Enemy {
  const e: Enemy = {
    id: allocId(s),
    kind,
    x: wrapX(x),
    y,
    vx: 0,
    vy: 0,
    radius: ENEMY_STATS[kind].radius,
    speed: speedFor(s, kind, false),
    fireTimer: 0,
    phase: range(s.rng, 0, Math.PI * 2),
    homeY: y,
    targetId: null,
    carryingId: null,
    aggressive: false,
    trailTimer: 0,
    dead: false,
  };
  if (kind === 'orb') {
    e.vx = range(s.rng, -1, 1) * e.speed;
    e.vy = range(s.rng, -0.6, 0.6) * e.speed;
  } else if (kind === 'trailer') {
    e.vx = chance(s.rng, 0.5) ? e.speed : -e.speed;
  }
  resetFireTimer(s, e);
  return e;
}

export function convertEnemy(s: GameState, e: Enemy, kind: EnemyKind): void {
  e.kind = kind;
  e.radius = ENEMY_STATS[kind].radius;
  e.speed = speedFor(s, kind, e.aggressive);
  e.targetId = null;
  e.carryingId = null;
  resetFireTimer(s, e);
}

export function makeAggressive(s: GameState, e: Enemy): void {
  e.aggressive = true;
  convertEnemy(s, e, e.kind === 'hunter' ? 'hunter' : 'nemesite');
}
