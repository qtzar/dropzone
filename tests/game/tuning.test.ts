import { describe, it, expect } from 'vitest';
import {
  getWaveTuning, WAVE_TABLE, effectiveWave, isInvasionWave, isShipmentWave, getInvasionTuning,
} from '../../src/game/tuning';

describe('getWaveTuning', () => {
  it('uses the explicit table for waves 1-10', () => {
    expect(WAVE_TABLE).toHaveLength(10);
    expect(getWaveTuning(1)).toEqual(WAVE_TABLE[0]);
    expect(getWaveTuning(10)).toEqual(WAVE_TABLE[9]);
  });

  it('waves 1-2 have no Blunderstorms; they appear from wave 3', () => {
    expect(getWaveTuning(1).storms).toBe(0);
    expect(getWaveTuning(2).storms).toBe(0);
    expect(getWaveTuning(3).storms).toBeGreaterThan(0);
  });

  it('wave 1 is gentle', () => {
    const t = getWaveTuning(1);
    expect(t.planters).toBeGreaterThan(0);
    expect(t.speedScale).toBe(1);
  });

  it('difficulty never decreases from wave to wave', () => {
    for (let w = 1; w < 40; w++) {
      const a = getWaveTuning(w);
      const b = getWaveTuning(w + 1);
      expect(b.planters + b.spores + b.storms).toBeGreaterThanOrEqual(a.planters + a.spores + a.storms);
      expect(b.speedScale).toBeGreaterThanOrEqual(a.speedScale);
      expect(b.fireInterval).toBeLessThanOrEqual(a.fireInterval);
    }
  });

  it('caps counts, speed and fire rate in late waves', () => {
    const t = getWaveTuning(500);
    expect(t.planters).toBeLessThanOrEqual(16);
    expect(t.spores).toBeLessThanOrEqual(8);
    expect(t.storms).toBeLessThanOrEqual(6);
    expect(t.speedScale).toBeLessThanOrEqual(2);
    expect(t.fireInterval).toBeGreaterThanOrEqual(0.9);
  });

  it('treats wave < 1 as wave 1', () => {
    expect(getWaveTuning(0)).toEqual(WAVE_TABLE[0]);
  });
});

describe('wave numbering', () => {
  it('plays waves 1-99 as numbered', () => {
    expect(effectiveWave(1)).toBe(1);
    expect(effectiveWave(57)).toBe(57);
    expect(effectiveWave(99)).toBe(99);
  });

  it('cycles 95-99 after wave 99', () => {
    expect([100, 101, 102, 103, 104, 105, 106].map(effectiveWave)).toEqual([95, 96, 97, 98, 99, 95, 96]);
  });

  it('every fifth wave is a Trailer invasion', () => {
    expect([1, 4, 5, 6, 10, 15, 95, 100].map(isInvasionWave)).toEqual([false, false, true, false, true, true, true, true]);
  });

  it('the wave after an invasion is a shipment, from wave 6', () => {
    expect([1, 6, 7, 11, 96, 101].map(isShipmentWave)).toEqual([false, true, false, true, true, true]);
  });

  it('an invasion has 6 + wave/5 Trailers and 2 Spores', () => {
    expect(getInvasionTuning(5)).toEqual({ trailers: 7, spores: 2 });
    expect(getInvasionTuning(10)).toEqual({ trailers: 8, spores: 2 });
    expect(getInvasionTuning(100)).toEqual({ trailers: 25, spores: 2 });
  });
});
