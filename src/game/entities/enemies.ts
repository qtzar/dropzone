import { wrapX } from '../../core/world';
import { range, chance } from '../../core/rng';
import { allocId, type GameState, type Enemy, type EnemyKind } from '../state';
import {
  PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX, STORM_BAND_TOP, STORM_BAND_BOTTOM, STORM_ACTION_MIN, STORM_ACTION_MAX,
  TRAILER_HOMER_CHANCE, NMEYE_BOMB_INTERVAL, ANTIMATTER_ORBIT_RADIUS,
} from '../constants';

export interface EnemyStats {
  radius: number;
  points: number;
  speed: number;
  /** Multiplier on the wave's enemy fire interval; 0 = never fires. */
  fireMult: number;
}

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  snatcher: { radius: 14, points: 150, speed: 130, fireMult: 2 },
  orb: { radius: 16, points: 100, speed: 60, fireMult: 0 },
  fragment: { radius: 7, points: 50, speed: 280, fireMult: 0 },
  hunter: { radius: 15, points: 500, speed: 400, fireMult: 0.5 },
  planter: { radius: 15, points: 250, speed: 90, fireMult: 2 },
  android: { radius: 9, points: 50, speed: 29, fireMult: 0 },
  nemesite: { radius: 13, points: 150, speed: 260, fireMult: 0.6 },
  spore: { radius: 14, points: 750, speed: 50, fireMult: 0 },
  trailer: { radius: 14, points: 250, speed: 200, fireMult: 1.5 },
  blunderstorm: { radius: 24, points: 250, speed: 40, fireMult: 0 },
  nmeye: { radius: 14, points: 100, speed: 760, fireMult: 0 },
  antimatter: { radius: 12, points: 150, speed: 160, fireMult: 0 },
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

/** Puts an Antimatter on its orbit so that its current position is angle 0 of the circle. */
export function startOrbit(e: Enemy): void {
  e.orbitAngle = 0;
  e.orbitX = wrapX(e.x - ANTIMATTER_ORBIT_RADIUS);
  e.orbitY = e.y;
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
    linkedId: null,
    tetherLen: 0,
    dodgeTimer: 0,
    dodgeDir: 1,
    warned: false,
    homer: false,
    falling: false,
    orbitAngle: 0,
    orbitX: 0,
    orbitY: 0,
    actionTimer: 0,
    bombTimer: 0,
    boltTimer: 0,
    dead: false,
  };
  switch (kind) {
    case 'orb':
      e.vx = range(s.rng, -1, 1) * e.speed;
      e.vy = range(s.rng, -0.6, 0.6) * e.speed;
      break;
    case 'trailer':
      e.vx = chance(s.rng, 0.5) ? e.speed : -e.speed;
      e.homer = chance(s.rng, TRAILER_HOMER_CHANCE);
      break;
    case 'planter':
      e.homeY = range(s.rng, PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX);
      e.y = e.homeY;
      e.vx = chance(s.rng, 0.5) ? e.speed : -e.speed;
      break;
    case 'spore': {
      const a = range(s.rng, 0, Math.PI * 2);
      e.vx = Math.cos(a) * e.speed;
      e.vy = Math.sin(a) * e.speed;
      break;
    }
    case 'blunderstorm':
      e.homeY = range(s.rng, STORM_BAND_TOP, STORM_BAND_BOTTOM);
      e.y = e.homeY;
      e.vx = chance(s.rng, 0.5) ? e.speed : -e.speed;
      e.actionTimer = range(s.rng, STORM_ACTION_MIN, STORM_ACTION_MAX);
      break;
    case 'nmeye':
      e.bombTimer = NMEYE_BOMB_INTERVAL;
      break;
    case 'antimatter':
      startOrbit(e);
      break;
    default:
      break;
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
  e.linkedId = null;
  e.tetherLen = 0;
  e.falling = false;
  e.dodgeTimer = 0;
  resetFireTimer(s, e);
}

export function makeAggressive(s: GameState, e: Enemy): void {
  e.aggressive = true;
  convertEnemy(s, e, e.kind === 'hunter' ? 'hunter' : 'nemesite');
}
