import { VIEW_W, WORLD_W, wrapX } from '../../core/world';
import { range, chance } from '../../core/rng';
import { createGameState, type GameState, type EnemyKind } from '../state';
import { emit } from '../events';
import {
  getWaveTuning, getInvasionTuning, effectiveWave, isInvasionWave, isShipmentWave,
} from '../tuning';
import { createEnemy } from '../entities/enemies';
import { spawnMen } from './rescue';
import { addScore } from './scoring';
import { clearHazards } from './hazards';
import {
  CEILING_Y, NMEYE_DELAY, NMEYE_REPEAT, NMEYE_MAX_ALIVE, MEN_PER_WAVE, SHIELD_PER_WAVE,
  SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME, WAVE_BONUS_PER_MAN, WAVE_BONUS_CAP,
} from '../constants';

const SPAWN_MIN_Y = CEILING_Y + 40;
const SPAWN_MAX_Y = 420;

/** Men in these states keep the wave going. */
const UNRESOLVED = new Set(['walking', 'carried', 'chased', 'falling']);

function spawnX(s: GameState): number {
  return wrapX(s.player.x + range(s.rng, SPAWN_SAFE_DISTANCE, WORLD_W - SPAWN_SAFE_DISTANCE));
}

export function startWave(s: GameState, wave: number): void {
  s.wave = wave;
  s.waveTime = 0;
  s.nextNmeyeAt = NMEYE_DELAY;
  s.savedThisWave = 0;
  s.unstable = false;
  s.phase = 'playing';
  s.phaseTimer = 0;

  if (isShipmentWave(wave)) s.survivors = MEN_PER_WAVE;
  // The game starts with SHIELD_START seconds; every later wave adds more (no cap).
  if (wave > 1) s.shieldBank += SHIELD_PER_WAVE;

  const t = getWaveTuning(effectiveWave(wave));
  s.speedScale = t.speedScale;
  s.enemyFireInterval = t.fireInterval;

  s.enemies = [];
  s.shots = [];
  clearHazards(s);
  s.lasers = [];
  s.men = [];
  s.player.carryingId = null;

  const invasion = isInvasionWave(wave);
  // Invasion waves have no men: the survivors wait for the next wave.
  if (!invasion) spawnMen(s, s.survivors);

  let groups: Array<[EnemyKind, number]>;
  if (invasion) {
    const inv = getInvasionTuning(wave);
    groups = [['trailer', inv.trailers], ['spore', inv.spores]];
  } else {
    groups = [['planter', t.planters], ['spore', t.spores], ['blunderstorm', t.storms]];
  }
  for (const [kind, n] of groups) {
    for (let i = 0; i < n; i++) {
      s.enemies.push(createEnemy(s, kind, spawnX(s), range(s.rng, SPAWN_MIN_Y, SPAWN_MAX_Y)));
    }
  }
  emit(s, { type: 'waveStarted', wave });
  if (invasion) emit(s, { type: 'invasionWave', wave });
}

export function updateWaveTimers(s: GameState, dt: number): void {
  s.waveTime += dt;
  while (s.waveTime >= s.nextNmeyeAt) {
    s.nextNmeyeAt += NMEYE_REPEAT;
    if (s.enemies.filter((e) => e.kind === 'nmeye' && !e.dead).length >= NMEYE_MAX_ALIVE) continue;
    const side = chance(s.rng, 0.5) ? 1 : -1;
    const x = wrapX(s.player.x + side * VIEW_W * 0.7);
    const y = range(s.rng, SPAWN_MIN_Y, 400);
    s.enemies.push(createEnemy(s, 'nmeye', x, y));
    emit(s, { type: 'nmeyeSpawned', x, y });
  }
}

/** End-of-wave bonus per survivor saved this wave: 100 x wave, capped at 500. */
export function waveBonusPerMan(wave: number): number {
  return Math.min(WAVE_BONUS_CAP, WAVE_BONUS_PER_MAN * effectiveWave(wave));
}

/** The wave ends when no enemy is alive and every man is saved or dead. */
export function checkWaveClear(s: GameState): void {
  if (s.phase !== 'playing') return;
  if (s.enemies.some((e) => !e.dead)) return;
  if (s.men.some((m) => UNRESOLVED.has(m.state))) return;

  // Men saved this wave are re-deployed next wave. Invasion waves have none, so survivors keep waiting.
  if (!isInvasionWave(s.wave)) s.survivors = s.savedThisWave;

  const bonus = s.savedThisWave * waveBonusPerMan(s.wave) * s.multiplier;
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
