import { describe, it, expect } from 'vitest';
import { STAR_FACTORS, MOUNTAIN_FACTOR, MOUNTAIN_PERIOD } from '../../src/render/background';
import { WORLD_W, VIEW_W } from '../../src/core/world';

describe('background parallax', () => {
  it('star layers wrap seamlessly at the world seam', () => {
    for (const f of STAR_FACTORS) expect((WORLD_W * f) % VIEW_W).toBe(0);
  });

  it('mountains wrap seamlessly at the world seam', () => {
    expect((WORLD_W * MOUNTAIN_FACTOR) % MOUNTAIN_PERIOD).toBe(0);
  });
});
