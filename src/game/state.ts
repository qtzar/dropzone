import { type Rng, createRng } from '../core/rng';
import type { GameEvent } from './events';
import { generateTerrain } from './terrain';
import { generateLandscape, applyLandscape, type Landscape } from './landscape';
import { START_LIVES, START_BOMBS, EXTRA_LIFE_EVERY, MEN_PER_WAVE, CEILING_Y } from './constants';

export type Facing = 1 | -1;

export interface Player {
  x: number;
  y: number;
  /** Position at the start of the last tick, for render interpolation. */
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  facing: Facing;
  thrusting: boolean;
  alive: boolean;
  respawnTimer: number;
  invuln: number;
  cloakActive: boolean;
  /** Cloak meter, 0..1. */
  cloak: number;
  /** Laser heat, 0..1. */
  heat: number;
  overheated: boolean;
  fireCooldown: number;
  carryingId: number | null;
}

export type ManState = 'walking' | 'carried' | 'snatched' | 'falling' | 'saved' | 'dead';

export interface Man {
  id: number;
  x: number;
  y: number;
  vy: number;
  dir: Facing;
  state: ManState;
  fallStartY: number;
  /** Enemy id while snatched. */
  holderId: number | null;
  walkTimer: number;
}

export type EnemyKind = 'snatcher' | 'nemesite' | 'trailer' | 'orb' | 'fragment' | 'hunter';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  fireTimer: number;
  /** Free-running phase for sine motion / animation. */
  phase: number;
  /** Trailer: centre line of its weave. */
  homeY: number;
  /** Snatcher: man being hunted. */
  targetId: number | null;
  /** Snatcher: man being carried. */
  carryingId: number | null;
  aggressive: boolean;
  trailTimer: number;
  dead: boolean;
}

export interface Laser {
  x: number;
  prevX: number;
  y: number;
  vx: number;
  life: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface TrailSeg {
  x: number;
  y: number;
  life: number;
}

export type GamePhase = 'playing' | 'waveComplete' | 'gameOver';

export interface GameState {
  seed: number;
  rng: Rng;
  time: number;
  wave: number;
  waveTime: number;
  nextHunterAt: number;
  score: number;
  lives: number;
  bombs: number;
  nextExtraLife: number;
  multiplier: number;
  comboTimer: number;
  hitStop: number;
  critical: boolean;
  /** Men to spawn at the start of the next wave. */
  menRemaining: number;
  savedThisWave: number;
  lastWaveBonus: number;
  speedScale: number;
  enemyFireInterval: number;
  phase: GamePhase;
  phaseTimer: number;
  baseX: number;
  terrain: number[];
  landscape: Landscape;
  player: Player;
  men: Man[];
  enemies: Enemy[];
  lasers: Laser[];
  shots: Shot[];
  trails: TrailSeg[];
  events: GameEvent[];
  nextId: number;
}

export const BASE_X = 640;

export function createGameState(seed: number): GameState {
  const rng = createRng(seed);
  const terrain = generateTerrain(rng, BASE_X);
  const landscape = generateLandscape(rng, BASE_X);
  applyLandscape(terrain, landscape);
  const startY = CEILING_Y + 200;
  return {
    seed,
    rng,
    time: 0,
    wave: 0,
    waveTime: 0,
    nextHunterAt: Infinity,
    score: 0,
    lives: START_LIVES,
    bombs: START_BOMBS,
    nextExtraLife: EXTRA_LIFE_EVERY,
    multiplier: 1,
    comboTimer: 0,
    hitStop: 0,
    critical: false,
    menRemaining: MEN_PER_WAVE,
    savedThisWave: 0,
    lastWaveBonus: 0,
    speedScale: 1,
    enemyFireInterval: 4,
    phase: 'playing',
    phaseTimer: 0,
    baseX: BASE_X,
    terrain,
    landscape,
    player: {
      x: BASE_X,
      y: startY,
      prevX: BASE_X,
      prevY: startY,
      vx: 0,
      vy: 0,
      facing: 1,
      thrusting: false,
      alive: true,
      respawnTimer: 0,
      invuln: 0,
      cloakActive: false,
      cloak: 1,
      heat: 0,
      overheated: false,
      fireCooldown: 0,
      carryingId: null,
    },
    men: [],
    enemies: [],
    lasers: [],
    shots: [],
    trails: [],
    events: [],
    nextId: 1,
  };
}

export function allocId(s: GameState): number {
  return s.nextId++;
}
