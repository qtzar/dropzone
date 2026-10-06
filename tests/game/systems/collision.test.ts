import { describe, it, expect } from 'vitest';
import { circlesOverlap, laserHitsCircle } from '../../../src/game/systems/collision';
import { WORLD_W } from '../../../src/core/world';
import type { Laser } from '../../../src/game/state';

const laser = (prevX: number, x: number, y: number, vx: number): Laser => ({ prevX, x, y, vx, life: 1 });

describe('circlesOverlap', () => {
  it('detects overlap and separation', () => {
    expect(circlesOverlap(0, 0, 10, 15, 0, 10)).toBe(true);
    expect(circlesOverlap(0, 0, 10, 25, 0, 10)).toBe(false);
  });

  it('works across the wrap seam', () => {
    expect(circlesOverlap(WORLD_W - 5, 100, 10, 5, 100, 10)).toBe(true);
  });
});

describe('laserHitsCircle', () => {
  it('hits a circle the laser swept through this tick (moving right)', () => {
    expect(laserHitsCircle(laser(100, 120, 50, 2200), 110, 52, 8)).toBe(true);
  });

  it('hits a circle the laser swept through this tick (moving left)', () => {
    expect(laserHitsCircle(laser(120, 100, 50, -2200), 110, 52, 8)).toBe(true);
  });

  it('misses circles behind or ahead of the swept segment', () => {
    expect(laserHitsCircle(laser(100, 120, 50, 2200), 80, 50, 8)).toBe(false);
    expect(laserHitsCircle(laser(100, 120, 50, 2200), 140, 50, 8)).toBe(false);
  });

  it('misses circles vertically out of range', () => {
    expect(laserHitsCircle(laser(100, 120, 50, 2200), 110, 70, 8)).toBe(false);
  });

  it('works across the wrap seam', () => {
    expect(laserHitsCircle(laser(WORLD_W - 10, 8, 50, 2200), 2, 50, 6)).toBe(true);
  });
});
