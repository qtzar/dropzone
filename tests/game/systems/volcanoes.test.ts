import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../src/game/state';
import { updateVolcanoes, erupt } from '../../../src/game/systems/volcanoes';
import { groundYAt } from '../../../src/game/terrain';
import {
  MAGMA_RADIUS, MAGMA_INTERVAL_MIN, MAGMA_INTERVAL_MAX, HOT_ROCK_RADIUS, HOT_INTERVAL_MIN, HOT_INTERVAL_MAX,
} from '../../../src/game/constants';

function oneVolcano(s: GameState, timer: number) {
  s.landscape = { volcanoes: [{ x: 3000, timer }], lakeX: 6000, ditches: [8000], craters: [9000] };
  return s.landscape.volcanoes[0];
}

describe('erupt (normal mode)', () => {
  it('lobs 1-2 magma balls with the spec velocities and resets the timer to 2.5-4 s', () => {
    const s = createGameState(1);
    const v = oneVolcano(s, 0);
    for (let i = 0; i < 40; i++) {
      s.magma = [];
      erupt(s, v);
      expect(s.magma.length).toBeGreaterThanOrEqual(1);
      expect(s.magma.length).toBeLessThanOrEqual(2);
      for (const m of s.magma) {
        expect(Math.abs(m.vx)).toBeGreaterThanOrEqual(60);
        expect(Math.abs(m.vx)).toBeLessThanOrEqual(160);
        expect(m.vy).toBeGreaterThanOrEqual(-380);
        expect(m.vy).toBeLessThanOrEqual(-260);
        expect(m.r).toBe(MAGMA_RADIUS);
        expect(m.hot).toBe(false);
        expect(m.x).toBe(3000);
        expect(m.y).toBeCloseTo(groundYAt(s.terrain, 3000) - 6);
      }
      expect(v.timer).toBeGreaterThanOrEqual(MAGMA_INTERVAL_MIN);
      expect(v.timer).toBeLessThanOrEqual(MAGMA_INTERVAL_MAX);
    }
    expect(s.events.some((e) => e.type === 'volcanoErupt' && !e.whiteHot)).toBe(true);
  });
});

describe('erupt (white-hot mode)', () => {
  it('throws 2-3 bigger, faster rocks every 1-1.8 s when the planet is unstable', () => {
    const s = createGameState(1);
    s.unstable = true;
    const v = oneVolcano(s, 0);
    for (let i = 0; i < 40; i++) {
      s.magma = [];
      erupt(s, v);
      expect(s.magma.length).toBeGreaterThanOrEqual(2);
      expect(s.magma.length).toBeLessThanOrEqual(3);
      for (const m of s.magma) {
        expect(m.vy).toBeGreaterThanOrEqual(-480);
        expect(m.vy).toBeLessThanOrEqual(-340);
        expect(m.r).toBe(HOT_ROCK_RADIUS);
        expect(m.hot).toBe(true);
      }
      expect(v.timer).toBeGreaterThanOrEqual(HOT_INTERVAL_MIN);
      expect(v.timer).toBeLessThanOrEqual(HOT_INTERVAL_MAX);
    }
    expect(s.events.some((e) => e.type === 'volcanoErupt' && e.whiteHot)).toBe(true);
  });
});

describe('updateVolcanoes', () => {
  it('erupts when the timer runs out', () => {
    const s = createGameState(1);
    const v = oneVolcano(s, 0.5);
    updateVolcanoes(s, 0.4);
    expect(s.magma).toHaveLength(0);
    updateVolcanoes(s, 0.2);
    expect(s.magma.length).toBeGreaterThan(0);
    expect(v.timer).toBeGreaterThan(2);
  });

  it('a long normal timer is cut to the hot interval once the planet goes unstable', () => {
    const s = createGameState(1);
    oneVolcano(s, 4);
    s.unstable = true;
    updateVolcanoes(s, HOT_INTERVAL_MAX + 0.01);
    expect(s.magma.length).toBeGreaterThanOrEqual(2);
  });

  it('every volcano of a real landscape erupts within 4 s', () => {
    const s = createGameState(1);
    let erupted = 0;
    for (let t = 0; t < 4.01; t += 0.01) {
      updateVolcanoes(s, 0.01);
      erupted += s.events.filter((e) => e.type === 'volcanoErupt').length;
      s.events.length = 0;
    }
    expect(erupted).toBeGreaterThanOrEqual(s.landscape.volcanoes.length);
  });
});
