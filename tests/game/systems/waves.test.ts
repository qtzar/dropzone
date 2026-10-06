import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import {
  startWave, updateWaveTimers, checkWaveClear, updateWavePhase, newGame,
} from '../../../src/game/systems/waves';
import { getWaveTuning } from '../../../src/game/tuning';
import {
  MEN_PER_WAVE, HUNTER_DELAY, HUNTER_REPEAT, SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME,
  WAVE_BONUS_PER_MAN, START_BOMBS, MAX_BOMBS,
} from '../../../src/game/constants';
import { shortestDx } from '../../../src/core/world';
import { addMan, addEnemy } from '../helpers';

describe('startWave', () => {
  it('spawns the tuned enemies and men for the wave', () => {
    const s = createGameState(1);
    startWave(s, 3);
    const t = getWaveTuning(3);
    const count = (k: string) => s.enemies.filter((e) => e.kind === k).length;
    expect(count('snatcher')).toBe(t.snatchers);
    expect(count('nemesite')).toBe(t.nemesites);
    expect(count('trailer')).toBe(t.trailers);
    expect(count('orb')).toBe(t.orbs);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
    expect(s.wave).toBe(3);
    expect(s.speedScale).toBe(t.speedScale);
    expect(s.enemyFireInterval).toBe(t.fireInterval);
    expect(s.phase).toBe('playing');
    expect(s.events).toContainEqual({ type: 'waveStarted', wave: 3 });
  });

  it('spawns enemies away from the player', () => {
    const s = createGameState(1);
    startWave(s, 10);
    for (const e of s.enemies) {
      expect(Math.abs(shortestDx(s.player.x, e.x))).toBeGreaterThanOrEqual(SPAWN_SAFE_DISTANCE - 1);
    }
  });

  it('resets per-wave state', () => {
    const s = createGameState(1);
    s.critical = true;
    s.savedThisWave = 4;
    s.player.cloak = 0;
    s.shots.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
    startWave(s, 2);
    expect(s.critical).toBe(false);
    expect(s.savedThisWave).toBe(0);
    expect(s.player.cloak).toBe(1);
    expect(s.shots).toHaveLength(0);
    expect(s.waveTime).toBe(0);
    expect(s.nextHunterAt).toBe(HUNTER_DELAY);
  });

  it('spawns no men after the planet went critical', () => {
    const s = createGameState(1);
    s.menRemaining = 0;
    startWave(s, 3);
    expect(s.men).toHaveLength(0);
  });

  it('restores men and awards a bomb at each 5-wave milestone', () => {
    const s = createGameState(1);
    s.menRemaining = 0;
    startWave(s, 6);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
    expect(s.bombs).toBe(START_BOMBS + 1);
    s.bombs = MAX_BOMBS;
    startWave(s, 11);
    expect(s.bombs).toBe(MAX_BOMBS);
  });
});

describe('hunters', () => {
  it('spawns a hunter after HUNTER_DELAY and then every HUNTER_REPEAT', () => {
    const s = createGameState(1);
    startWave(s, 1);
    const hunters = () => s.enemies.filter((e) => e.kind === 'hunter').length;
    updateWaveTimers(s, HUNTER_DELAY - 0.01);
    expect(hunters()).toBe(0);
    updateWaveTimers(s, 0.02);
    expect(hunters()).toBe(1);
    expect(s.events.some((e) => e.type === 'hunterSpawned')).toBe(true);
    updateWaveTimers(s, HUNTER_REPEAT);
    expect(hunters()).toBe(2);
  });
});

describe('wave clear', () => {
  it('does nothing while enemies remain', () => {
    const s = createGameState(1);
    addEnemy(s, 'snatcher', 3000, 300);
    checkWaveClear(s);
    expect(s.phase).toBe('playing');
  });

  it('awards the rescue bonus and enters waveComplete when no enemies remain', () => {
    const s = createGameState(1);
    s.wave = 4;
    s.savedThisWave = 3;
    checkWaveClear(s);
    const bonus = 3 * WAVE_BONUS_PER_MAN * 4;
    expect(s.phase).toBe('waveComplete');
    expect(s.phaseTimer).toBe(WAVE_COMPLETE_TIME);
    expect(s.score).toBe(bonus);
    expect(s.lastWaveBonus).toBe(bonus);
    expect(s.events).toContainEqual({ type: 'waveCleared', wave: 4, bonus, saved: 3 });
  });

  it('counts a carried man as saved', () => {
    const s = createGameState(1);
    s.wave = 1;
    const m = addMan(s, s.player.x, 'carried');
    s.player.carryingId = m.id;
    checkWaveClear(s);
    expect(s.savedThisWave).toBe(1);
    expect(m.state).toBe('saved');
    expect(s.player.carryingId).toBeNull();
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

describe('newGame', () => {
  it('creates a state already in wave 1', () => {
    const s = newGame(99);
    expect(s.wave).toBe(1);
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
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
