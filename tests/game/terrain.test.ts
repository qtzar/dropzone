import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { WORLD_W } from '../../src/core/world';
import { BASE_WIDTH } from '../../src/game/constants';
import {
  generateTerrain, groundYAt, TERRAIN_SAMPLES, TERRAIN_STEP,
  GROUND_MIN_Y, GROUND_MAX_Y, BASE_GROUND_Y,
} from '../../src/game/terrain';

describe('terrain', () => {
  const baseX = 640;
  const terrain = generateTerrain(createRng(1), baseX);

  it('has one sample per TERRAIN_STEP across the world', () => {
    expect(TERRAIN_SAMPLES * TERRAIN_STEP).toBe(WORLD_W);
    expect(terrain.length).toBe(TERRAIN_SAMPLES);
  });

  it('stays within ground bounds', () => {
    for (const h of terrain) {
      expect(h).toBeGreaterThanOrEqual(GROUND_MIN_Y);
      expect(h).toBeLessThanOrEqual(GROUND_MAX_Y);
    }
  });

  it('wraps seamlessly', () => {
    expect(groundYAt(terrain, 0)).toBeCloseTo(groundYAt(terrain, WORLD_W));
    expect(groundYAt(terrain, -10)).toBeCloseTo(groundYAt(terrain, WORLD_W - 10));
  });

  it('interpolates between samples', () => {
    const a = groundYAt(terrain, TERRAIN_STEP * 10);
    const b = groundYAt(terrain, TERRAIN_STEP * 11);
    expect(groundYAt(terrain, TERRAIN_STEP * 10.5)).toBeCloseTo((a + b) / 2);
  });

  it('is flat under the base pad', () => {
    for (let dx = -BASE_WIDTH / 2; dx <= BASE_WIDTH / 2; dx += 8) {
      expect(groundYAt(terrain, baseX + dx)).toBe(BASE_GROUND_Y);
    }
  });

  it('is deterministic for a seed', () => {
    expect(generateTerrain(createRng(1), baseX)).toEqual(terrain);
    expect(generateTerrain(createRng(2), baseX)).not.toEqual(terrain);
  });
});
