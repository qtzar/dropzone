import { describe, it, expect } from 'vitest';
import { SCANNER, scannerPos, scannerTerrainOffsets, shieldLabel, waveBanner, BANNER_TIME } from '../../src/render/hud';
import { createGameState } from '../../src/game/state';
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

describe('shieldLabel', () => {
  it('shows the shield bank in seconds with one decimal', () => {
    expect(shieldLabel(12.4)).toBe('SHIELD 12.4s');
    expect(shieldLabel(7)).toBe('SHIELD 7.0s');
    expect(shieldLabel(0)).toBe('SHIELD 0.0s');
  });
});

describe('waveBanner', () => {
  it('announces the wave for the first 3 s', () => {
    const s = createGameState(1);
    s.wave = 4;
    s.waveTime = 1;
    expect(waveBanner(s)).toBe('WAVE 4');
    s.waveTime = BANNER_TIME;
    expect(waveBanner(s)).toBeNull();
  });

  it('announces a Trailer invasion on invasion waves', () => {
    const s = createGameState(1);
    s.wave = 10;
    s.waveTime = 0.5;
    expect(waveBanner(s)).toBe('TRAILER INVASION');
  });

  it('shows nothing outside play', () => {
    const s = createGameState(1);
    s.wave = 2;
    s.phase = 'waveComplete';
    expect(waveBanner(s)).toBeNull();
  });
});
