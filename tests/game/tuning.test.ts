import { describe, it, expect } from 'vitest';
import { getWaveTuning, WAVE_TABLE } from '../../src/game/tuning';

describe('getWaveTuning', () => {
  it('uses the explicit table for waves 1-10', () => {
    expect(WAVE_TABLE).toHaveLength(10);
    expect(getWaveTuning(1)).toEqual(WAVE_TABLE[0]);
    expect(getWaveTuning(10)).toEqual(WAVE_TABLE[9]);
  });

  it('wave 1 is gentle', () => {
    const t = getWaveTuning(1);
    expect(t.nemesites).toBe(0);
    expect(t.speedScale).toBe(1);
  });

  it('difficulty never decreases from wave to wave', () => {
    for (let w = 1; w < 40; w++) {
      const a = getWaveTuning(w);
      const b = getWaveTuning(w + 1);
      const total = (t: typeof a) => t.snatchers + t.nemesites + t.trailers + t.orbs;
      expect(total(b)).toBeGreaterThanOrEqual(total(a));
      expect(b.speedScale).toBeGreaterThanOrEqual(a.speedScale);
      expect(b.fireInterval).toBeLessThanOrEqual(a.fireInterval);
    }
  });

  it('caps speed and fire rate in late waves', () => {
    const t = getWaveTuning(500);
    expect(t.speedScale).toBeLessThanOrEqual(2);
    expect(t.fireInterval).toBeGreaterThanOrEqual(0.9);
  });

  it('treats wave < 1 as wave 1', () => {
    expect(getWaveTuning(0)).toEqual(WAVE_TABLE[0]);
  });
});
