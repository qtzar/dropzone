import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../src/game/state';
import {
  startWave, updateWaveTimers, checkWaveClear, updateWavePhase, newGame, waveBonusPerMan,
} from '../../../src/game/systems/waves';
import { getWaveTuning } from '../../../src/game/tuning';
import { registerKill } from '../../../src/game/systems/scoring';
import {
  MEN_PER_WAVE, NMEYE_DELAY, NMEYE_REPEAT, SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME,
  START_BOMBS, SHIELD_START, SHIELD_PER_WAVE,
} from '../../../src/game/constants';
import { shortestDx } from '../../../src/core/world';
import { addMan, addEnemy } from '../helpers';

const count = (s: GameState, k: string) => s.enemies.filter((e) => e.kind === k).length;

describe('startWave', () => {
  it('spawns the tuned Planters, Spores and Blunderstorms and deploys the survivors', () => {
    const s = createGameState(1);
    startWave(s, 3);
    const t = getWaveTuning(3);
    expect(count(s, 'planter')).toBe(t.planters);
    expect(count(s, 'spore')).toBe(t.spores);
    expect(count(s, 'blunderstorm')).toBe(t.storms);
    expect(s.enemies).toHaveLength(t.planters + t.spores + t.storms);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
    expect(s.wave).toBe(3);
    expect(s.speedScale).toBe(t.speedScale);
    expect(s.enemyFireInterval).toBe(t.fireInterval);
    expect(s.phase).toBe('playing');
    expect(s.events).toContainEqual({ type: 'waveStarted', wave: 3 });
  });

  it('waves 1 and 2 have no Blunderstorms', () => {
    const s = createGameState(1);
    startWave(s, 1);
    expect(count(s, 'blunderstorm')).toBe(0);
    startWave(s, 2);
    expect(count(s, 'blunderstorm')).toBe(0);
  });

  it('spawns enemies away from the player', () => {
    const s = createGameState(1);
    startWave(s, 9);
    for (const e of s.enemies) {
      expect(Math.abs(shortestDx(s.player.x, e.x))).toBeGreaterThanOrEqual(SPAWN_SAFE_DISTANCE - 1);
    }
  });

  it('resets per-wave state', () => {
    const s = createGameState(1);
    s.unstable = true;
    s.savedThisWave = 4;
    s.shots.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
    startWave(s, 2);
    expect(s.unstable).toBe(false);
    expect(s.savedThisWave).toBe(0);
    expect(s.shots).toHaveLength(0);
    expect(s.waveTime).toBe(0);
    expect(s.nextNmeyeAt).toBe(NMEYE_DELAY);
  });

  it('deploys only the survivors of the previous wave', () => {
    const s = createGameState(1);
    s.survivors = 3;
    startWave(s, 2);
    expect(s.men).toHaveLength(3);
  });

  it('a wave after the planet went unstable has no men', () => {
    const s = createGameState(1);
    s.survivors = 0;
    startWave(s, 3);
    expect(s.men).toHaveLength(0);
  });
});

describe('invasion waves', () => {
  it('every fifth wave is a Trailer invasion: 6 + wave/5 Trailers, 2 Spores, no men', () => {
    const s = createGameState(1);
    s.survivors = 5;
    startWave(s, 5);
    expect(count(s, 'trailer')).toBe(7);
    expect(count(s, 'spore')).toBe(2);
    expect(count(s, 'planter')).toBe(0);
    expect(s.men).toHaveLength(0);
    expect(s.events).toContainEqual({ type: 'invasionWave', wave: 5 });
  });

  it('survivors wait through an invasion and come back next wave', () => {
    const s = createGameState(1);
    s.survivors = 2;
    startWave(s, 10);
    s.enemies = [];
    checkWaveClear(s);
    expect(s.phase).toBe('waveComplete');
    expect(s.survivors).toBe(2);
    expect(s.lastWaveBonus).toBe(0);
  });
});

describe('shipments', () => {
  it('the wave after an invasion tops the men back up to 8 (no bonus bomb any more)', () => {
    const s = createGameState(1);
    s.survivors = 0;
    startWave(s, 6);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
    expect(s.survivors).toBe(MEN_PER_WAVE);
    expect(s.bombs).toBe(START_BOMBS);
  });
});

describe('shield bank', () => {
  it('starts at 7 s and gains 7 s at the start of every later wave, with no cap', () => {
    const s = createGameState(1);
    startWave(s, 1);
    expect(s.shieldBank).toBe(SHIELD_START);
    startWave(s, 2);
    expect(s.shieldBank).toBe(SHIELD_START + SHIELD_PER_WAVE);
    for (let w = 3; w <= 10; w++) startWave(s, w);
    expect(s.shieldBank).toBe(SHIELD_START + 9 * SHIELD_PER_WAVE);
  });
});

describe('wave 95-99 cycle', () => {
  it('wave 100 plays as wave 95 (an invasion) but keeps its displayed number', () => {
    const s = createGameState(1);
    startWave(s, 100);
    expect(s.wave).toBe(100);
    expect(count(s, 'trailer')).toBe(6 + 19);
    expect(s.speedScale).toBe(getWaveTuning(95).speedScale);
  });

  it('wave 101 plays as wave 96, a shipment', () => {
    const s = createGameState(1);
    s.survivors = 0;
    startWave(s, 101);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
    expect(count(s, 'planter')).toBe(getWaveTuning(96).planters);
  });
});

describe('nmeye timer', () => {
  it('spawns an Nmeye 60 s into the wave and then every 20 s', () => {
    const s = createGameState(1);
    startWave(s, 1);
    expect(NMEYE_DELAY).toBe(60);
    expect(NMEYE_REPEAT).toBe(20);
    const nmeyes = () => count(s, 'nmeye');
    updateWaveTimers(s, NMEYE_DELAY - 0.01);
    expect(nmeyes()).toBe(0);
    updateWaveTimers(s, 0.02);
    expect(nmeyes()).toBe(1);
    expect(s.events.some((e) => e.type === 'nmeyeSpawned')).toBe(true);
    updateWaveTimers(s, NMEYE_REPEAT);
    expect(nmeyes()).toBe(2);
  });
});

describe('wave clear', () => {
  it('does nothing while enemies remain', () => {
    const s = createGameState(1);
    addEnemy(s, 'planter', 3000, 300);
    checkWaveClear(s);
    expect(s.phase).toBe('playing');
  });

  it('does nothing while any man is walking, carried, chased or falling', () => {
    for (const state of ['walking', 'carried', 'chased', 'falling'] as const) {
      const s = createGameState(1);
      s.wave = 2;
      addMan(s, 3000, state);
      addMan(s, 4000, 'saved');
      checkWaveClear(s);
      expect(s.phase).toBe('playing');
    }
  });

  it('ends once no enemies are left and every man is saved or dead', () => {
    const s = createGameState(1);
    s.wave = 2;
    addMan(s, 3000, 'saved');
    addMan(s, 4000, 'dead');
    checkWaveClear(s);
    expect(s.phase).toBe('waveComplete');
    expect(s.phaseTimer).toBe(WAVE_COMPLETE_TIME);
  });

  it('awards survivors x 100 x wave, and the survivors carry over to the next wave', () => {
    const s = createGameState(1);
    s.wave = 4;
    s.savedThisWave = 3;
    checkWaveClear(s);
    const bonus = 3 * 400;
    expect(s.score).toBe(bonus);
    expect(s.lastWaveBonus).toBe(bonus);
    expect(s.survivors).toBe(3);
    expect(s.events).toContainEqual({ type: 'waveCleared', wave: 4, bonus, saved: 3 });
  });

  it('caps the bonus at 500 per man and applies the combo multiplier', () => {
    expect(waveBonusPerMan(3)).toBe(300);
    expect(waveBonusPerMan(5)).toBe(500);
    expect(waveBonusPerMan(42)).toBe(500);
    const s = createGameState(1);
    s.wave = 7;
    s.savedThisWave = 2;
    registerKill(s, 0, 0, 0);
    registerKill(s, 0, 0, 0); // x2
    checkWaveClear(s);
    expect(s.lastWaveBonus).toBe(2 * 500 * 2);
  });

  it('starts the next wave after WAVE_COMPLETE_TIME', () => {
    const s = createGameState(1);
    s.wave = 1;
    checkWaveClear(s);
    updateWavePhase(s, WAVE_COMPLETE_TIME - 0.1);
    expect(s.phase).toBe('waveComplete');
    updateWavePhase(s, 0.2);
    expect(s.phase).toBe('playing');
    expect(s.wave).toBe(2);
  });
});

describe('hazards on wave start', () => {
  it('startWave clears magma, acid, bolts and nmeye bombs', () => {
    const s = createGameState(1);
    s.magma.push({ x: 0, y: 0, vx: 0, vy: 0, r: 5, hot: false });
    s.acid.push({ x: 0, y: 0, vy: 1 });
    s.bolts.push({ x: 0, top: 0, bottom: 1, life: 1 });
    s.eyeBombs.push({ x: 0, y: 0, vy: 1 });
    startWave(s, 2);
    expect(s.magma.length + s.acid.length + s.bolts.length + s.eyeBombs.length).toBe(0);
  });
});

describe('newGame', () => {
  it('creates a state already in wave 1', () => {
    const s = newGame(99);
    expect(s.wave).toBe(1);
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
  });
});
