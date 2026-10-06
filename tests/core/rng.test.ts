import { describe, it, expect } from 'vitest';
import { createRng, nextFloat, range, intRange, chance } from '../../src/core/rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(nextFloat(a)).toBe(nextFloat(b));
  });

  it('differs for different seeds', () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
  });

  it('nextFloat is in [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = nextFloat(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range and intRange respect bounds', () => {
    const r = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const f = range(r, -5, 5);
      expect(f).toBeGreaterThanOrEqual(-5);
      expect(f).toBeLessThan(5);
      const n = intRange(r, 2, 6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThan(6);
    }
  });

  it('chance(0) is never true and chance(1) is always true', () => {
    const r = createRng(3);
    for (let i = 0; i < 100; i++) {
      expect(chance(r, 0)).toBe(false);
      expect(chance(r, 1)).toBe(true);
    }
  });

  it('state is plain data so it can be stored in GameState', () => {
    const r = createRng(5);
    nextFloat(r);
    const copy = { state: r.state };
    expect(nextFloat(copy)).toBe(nextFloat(r));
  });
});
