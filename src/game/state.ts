import { type Rng, createRng } from '../core/rng';
import type { GameEvent } from './events';
import { generateTerrain } from './terrain';
import { generateLandscape, applyLandscape, type Landscape } from './landscape';
import { START_LIVES, START_BOMBS, EXTRA_LIFE_EVERY, MEN_PER_WAVE, CEILING_Y, SHIELD_START } from './constants';

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
  /** Shield (cloak) on; it drains s.shieldBank. */
  cloakActive: boolean;
  /** Laser heat, 0..1. */
  heat: number;
  overheated: boolean;
  fireCooldown: number;
  carryingId: number | null;
}

export type ManState = 'walking' | 'carried' | 'chased' | 'falling' | 'saved' | 'dead';

export interface Man {
  id: number;
  x: number;
  y: number;
  vy: number;
  dir: Facing;
  state: ManState;
  fallStartY: number;
  /** Enemy id of the Android chasing him while chased. */
  holderId: number | null;
  walkTimer: number;
  /** Times he has turned back at an obstacle edge since he last crossed one. */
  turnBacks: number;
  /** True while hopping over a lava ditch or wading through the lake. */
  crossing: boolean;
}

export type EnemyKind = 'planter' | 'android' | 'nemesite' | 'spore' | 'trailer' | 'blunderstorm' | 'nmeye' | 'antimatter';

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
  /** Trailer: centre line of its weave. Planter: cruise height. Blunderstorm: band height. */
  homeY: number;
  /** Android: the man it is chasing. */
  targetId: number | null;
  /** Planter: id of the Android it is lowering. Android: id of the Planter lowering it. */
  linkedId: number | null;
  /** Planter: current tether length in px while lowering. */
  tetherLen: number;
  /** Nemesite: seconds left in the current dodge jink. */
  dodgeTimer: number;
  /** Nemesite: vertical direction of the current jink. */
  dodgeDir: Facing;
  /** Nemesite: the proximity warning has fired. */
  warned: boolean;
  /** Trailer: homes toward the player instead of weaving. */
  homer: boolean;
  /** Android: released from its Planter in mid-air and falling. */
  falling: boolean;
  /** Antimatter: angle around the orbit centre. */
  orbitAngle: number;
  /** Antimatter: orbit centre. */
  orbitX: number;
  orbitY: number;
  /** Blunderstorm: seconds to the next storm action. Nmeye: seconds to the next heading change. */
  actionTimer: number;
  /** Nmeye: seconds to the next bomb. */
  bombTimer: number;
  /** Blunderstorm: seconds until the pending proton bolt (0 = none pending). */
  boltTimer: number;
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

/** Volcano magma ball or white-hot rock. */
export interface Magma {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hot: boolean;
}

/** Blunderstorm acid drop. */
export interface Acid {
  x: number;
  y: number;
  vy: number;
}

/** Blunderstorm proton bolt: a vertical lethal column. */
export interface Bolt {
  x: number;
  top: number;
  bottom: number;
  life: number;
}

/** Bomb dropped by an Nmeye. */
export interface EyeBomb {
  x: number;
  y: number;
  vy: number;
}

export type GamePhase = 'playing' | 'waveComplete' | 'gameOver';

export interface GameState {
  seed: number;
  rng: Rng;
  time: number;
  wave: number;
  waveTime: number;
  /** waveTime at which the next Nmeye appears. */
  nextNmeyeAt: number;
  score: number;
  lives: number;
  bombs: number;
  nextExtraLife: number;
  multiplier: number;
  comboTimer: number;
  hitStop: number;
  unstable: boolean;
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
  magma: Magma[];
  acid: Acid[];
  bolts: Bolt[];
  eyeBombs: EyeBomb[];
  /** Seconds of shield (cloak) left. */
  shieldBank: number;
  /** Men to deploy at the start of the next wave. */
  survivors: number;
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
    nextNmeyeAt: Infinity,
    score: 0,
    lives: START_LIVES,
    bombs: START_BOMBS,
    nextExtraLife: EXTRA_LIFE_EVERY,
    multiplier: 1,
    comboTimer: 0,
    hitStop: 0,
    unstable: false,
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
      heat: 0,
      overheated: false,
      fireCooldown: 0,
      carryingId: null,
    },
    men: [],
    enemies: [],
    lasers: [],
    shots: [],
    magma: [],
    acid: [],
    bolts: [],
    eyeBombs: [],
    shieldBank: SHIELD_START,
    survivors: MEN_PER_WAVE,
    events: [],
    nextId: 1,
  };
}

export function allocId(s: GameState): number {
  return s.nextId++;
}
