import { VIEW_W, WORLD_W, wrapX } from '../../core/world';
import { range, chance } from '../../core/rng';
import { createGameState, type GameState, type EnemyKind } from '../state';
import { emit } from '../events';
import { findMan } from '../query';
import { getWaveTuning } from '../tuning';
import { createEnemy } from '../entities/enemies';
import { spawnMen } from './rescue';
import { addScore } from './scoring';
import {
  CEILING_Y, HUNTER_DELAY, HUNTER_REPEAT, MILESTONE_EVERY, MEN_PER_WAVE, MAX_BOMBS,
  SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME, WAVE_BONUS_PER_MAN,
} from '../constants';

const SPAWN_MIN_Y = CEILING_Y + 40;
const SPAWN_MAX_Y = 420;

function spawnX(s: GameState): number {
  return wrapX(s.player.x + range(s.rng, SPAWN_SAFE_DISTANCE, WORLD_W - SPAWN_SAFE_DISTANCE));
}

export function startWave(s: GameState, wave: number): void {
  s.wave = wave;
  s.waveTime = 0;
  s.nextHunterAt = HUNTER_DELAY;
  s.savedThisWave = 0;
  s.critical = false;
  s.phase = 'playing';
  s.phaseTimer = 0;

  if (wave > 1 && (wave - 1) % MILESTONE_EVERY === 0) {
    s.menRemaining = MEN_PER_WAVE;
    s.bombs = Math.min(MAX_BOMBS, s.bombs + 1);
  }

  const t = getWaveTuning(wave);
  s.speedScale = t.speedScale;
  s.enemyFireInterval = t.fireInterval;

  s.enemies = [];
  s.shots = [];
  s.trails = [];
  s.lasers = [];
  s.men = [];
  s.player.carryingId = null;
  s.player.cloak = 1;

  spawnMen(s, s.menRemaining);

  const groups: Array<[EnemyKind, number]> = [
    ['snatcher', t.snatchers],
    ['nemesite', t.nemesites],
    ['trailer', t.trailers],
    ['orb', t.orbs],
  ];
  for (const [kind, n] of groups) {
    for (let i = 0; i < n; i++) {
      s.enemies.push(createEnemy(s, kind, spawnX(s), range(s.rng, SPAWN_MIN_Y, SPAWN_MAX_Y)));
    }
  }
  emit(s, { type: 'waveStarted', wave });
}

export function updateWaveTimers(s: GameState, dt: number): void {
  s.waveTime += dt;
  while (s.waveTime >= s.nextHunterAt) {
    const side = chance(s.rng, 0.5) ? 1 : -1;
    const x = wrapX(s.player.x + side * VIEW_W * 0.7);
    const y = range(s.rng, SPAWN_MIN_Y, 400);
    s.enemies.push(createEnemy(s, 'hunter', x, y));
    s.nextHunterAt += HUNTER_REPEAT;
    emit(s, { type: 'hunterSpawned', x, y });
  }
}

export function checkWaveClear(s: GameState): void {
  if (s.phase !== 'playing') return;
  if (s.enemies.some((e) => !e.dead)) return;

  const p = s.player;
  if (p.carryingId !== null) {
    const m = findMan(s, p.carryingId);
    if (m) m.state = 'saved';
    p.carryingId = null;
    s.savedThisWave++;
  }

  const bonus = s.savedThisWave * WAVE_BONUS_PER_MAN * s.wave;
  addScore(s, bonus);
  s.lastWaveBonus = bonus;
  s.phase = 'waveComplete';
  s.phaseTimer = WAVE_COMPLETE_TIME;
  emit(s, { type: 'waveCleared', wave: s.wave, bonus, saved: s.savedThisWave });
}

export function updateWavePhase(s: GameState, dt: number): void {
  if (s.phase !== 'waveComplete') return;
  s.phaseTimer -= dt;
  if (s.phaseTimer <= 0) startWave(s, s.wave + 1);
}

export function newGame(seed: number): GameState {
  const s = createGameState(seed);
  startWave(s, 1);
  return s;
}
