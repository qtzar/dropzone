import { describe, it, expect } from 'vitest';
import { NO_ACTIONS, type Actions } from '../../src/core/input';
import { update } from '../../src/game/update';
import { newGame } from '../../src/game/systems/waves';
import { SIM_DT, MEN_PER_WAVE } from '../../src/game/constants';
import type { GameState } from '../../src/game/state';

/** Deterministic scripted pilot: sweeps back and forth, bobs, fires constantly, bombs and cloaks periodically. */
function scriptedActions(tick: number): Actions {
  const t = tick * SIM_DT;
  return {
    ...NO_ACTIONS,
    moveX: Math.sin(t * 0.4) > 0 ? 1 : -1,
    moveY: Math.sin(t * 1.3),
    fire: true,
    bomb: tick > 0 && tick % (120 * 10) === 0,
    cloak: t % 15 < 2,
  };
}

function simulate(seed: number, seconds: number, lives?: number): { s: GameState; nmeyes: number } {
  const s = newGame(seed);
  if (lives !== undefined) s.lives = lives;
  const ticks = Math.round(seconds / SIM_DT);
  let nmeyes = 0;
  for (let i = 0; i < ticks; i++) {
    update(s, scriptedActions(i), SIM_DT);
    for (const e of s.events) if (e.type === 'nmeyeSpawned') nmeyes++;
    s.events.length = 0;
  }
  return { s, nmeyes };
}

function allFinite(s: GameState): boolean {
  const nums: number[] = [s.score, s.player.x, s.player.y, s.player.vx, s.player.vy, s.time];
  for (const e of s.enemies) nums.push(e.x, e.y, e.vx, e.vy);
  for (const m of s.men) nums.push(m.x, m.y);
  for (const sh of s.shots) nums.push(sh.x, sh.y);
  for (const m of s.magma) nums.push(m.x, m.y);
  return nums.every(Number.isFinite);
}

describe('deterministic simulation', () => {
  it('runs 90 s of scripted play without NaNs or runaway entity counts', () => {
    const { s, nmeyes } = simulate(1234, 90, 99);
    expect(s.time).toBeCloseTo(90, 0);
    expect(nmeyes).toBeGreaterThanOrEqual(1);
    expect(allFinite(s)).toBe(true);
    expect(s.enemies.length).toBeLessThan(200);
    expect(s.shots.length).toBeLessThan(500);
    expect(s.magma.length + s.acid.length + s.eyeBombs.length).toBeLessThan(500);
    expect(s.wave).toBeGreaterThanOrEqual(1);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.lives).toBeGreaterThanOrEqual(0);
  });

  it('is fully deterministic for a given seed', () => {
    const a = simulate(777, 30).s;
    const b = simulate(777, 30).s;
    expect(b.score).toBe(a.score);
    expect(b.wave).toBe(a.wave);
    expect(b.lives).toBe(a.lives);
    expect(b.player.x).toBe(a.player.x);
    expect(b.enemies.length).toBe(a.enemies.length);
    expect(b.rng.state).toBe(a.rng.state);
  });
});

describe('wave progression', () => {
  it('reaches wave 6 with a fresh shipment of men even after the planet went unstable', () => {
    const s = newGame(42);
    s.lives = 99;
    let unstableSeen = false;
    const menAtStart: number[] = [];
    let lastWave = 0;
    for (let i = 0; i < 120 * 600 && s.wave < 6; i++) {
      if (s.wave !== lastWave) {
        menAtStart[s.wave] = s.men.length;
        lastWave = s.wave;
      }
      // Clear the enemies and resolve every man: wave 3 loses them all, the others are saved.
      s.enemies = [];
      for (const m of s.men) {
        if (m.state === 'saved' || m.state === 'dead') continue;
        m.state = s.wave === 3 ? 'dead' : 'saved';
        if (m.state === 'saved') s.savedThisWave++;
      }
      s.player.carryingId = null;
      update(s, NO_ACTIONS, SIM_DT);
      if (s.unstable) unstableSeen = true;
      s.events.length = 0;
    }
    expect(s.wave).toBe(6);
    expect(unstableSeen).toBe(true);
    expect(menAtStart[2]).toBe(MEN_PER_WAVE);
    expect(menAtStart[4]).toBe(0); // planet went unstable in wave 3
    expect(menAtStart[5]).toBe(0); // invasion wave
    expect(s.men).toHaveLength(MEN_PER_WAVE); // shipment
  });
});
