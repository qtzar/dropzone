import { describe, it, expect } from 'vitest';
import { SCANNER, scannerPos, scannerTerrainOffsets } from '../../src/render/hud';
import { WORLD_W, VIEW_H } from '../../src/core/world';
import { CEILING_Y } from '../../src/game/constants';

describe('scannerPos', () => {
  const cx = SCANNER.x + SCANNER.w / 2;

  it('puts the camera position at the scanner centre', () => {
    expect(scannerPos(5000, CEILING_Y, 5000).x).toBe(cx);
  });

  it('maps half the world to half the scanner width', () => {
    expect(scannerPos(5000 + WORLD_W / 4, CEILING_Y, 5000).x).toBeCloseTo(cx + SCANNER.w / 4);
  });

  it('wraps across the seam', () => {
    expect(scannerPos(100, CEILING_Y, WORLD_W - 100).x).toBeCloseTo(cx + (200 * SCANNER.w) / WORLD_W);
  });

  it('maps ceiling to top and bottom of view to bottom (inside a 4px margin)', () => {
    expect(scannerPos(0, CEILING_Y, 0).y).toBe(SCANNER.y + 4);
    expect(scannerPos(0, VIEW_H, 0).y).toBe(SCANNER.y + SCANNER.h - 4);
    expect(scannerPos(0, -500, 0).y).toBe(SCANNER.y + 4);
  });
});

describe('scanner mini-terrain', () => {
  it('produces strictly increasing scanner x positions (no wrap-around segment)', () => {
    for (const camX of [0, 5000, WORLD_W - 1]) {
      const xs = scannerTerrainOffsets(128).map((dx) => scannerPos(camX + dx, CEILING_Y, camX).x);
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
      expect(xs[0]).toBeGreaterThanOrEqual(SCANNER.x);
      expect(xs[xs.length - 1]).toBeLessThanOrEqual(SCANNER.x + SCANNER.w);
    }
  });
});
