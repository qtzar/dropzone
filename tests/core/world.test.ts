import { describe, it, expect } from 'vitest';
import { WORLD_W, VIEW_W, wrapX, shortestDx, toScreenX, lerpWrapped, clamp } from '../../src/core/world';

describe('world', () => {
  it('has a world 8 screens wide', () => {
    expect(WORLD_W).toBe(VIEW_W * 8);
  });

  it('wrapX keeps values in [0, WORLD_W)', () => {
    expect(wrapX(0)).toBe(0);
    expect(wrapX(WORLD_W)).toBe(0);
    expect(wrapX(-1)).toBe(WORLD_W - 1);
    expect(wrapX(WORLD_W + 5)).toBe(5);
    expect(wrapX(-WORLD_W * 3 - 10)).toBe(WORLD_W - 10);
  });

  it('shortestDx takes the short way around the seam', () => {
    expect(shortestDx(100, 200)).toBe(100);
    expect(shortestDx(200, 100)).toBe(-100);
    expect(shortestDx(WORLD_W - 10, 10)).toBe(20);
    expect(shortestDx(10, WORLD_W - 10)).toBe(-20);
  });

  it('toScreenX centres the camera on screen and handles the seam', () => {
    expect(toScreenX(1000, 1000)).toBe(VIEW_W / 2);
    expect(toScreenX(1100, 1000)).toBe(VIEW_W / 2 + 100);
    expect(toScreenX(20, WORLD_W - 20)).toBe(VIEW_W / 2 + 40);
  });

  it('lerpWrapped interpolates across the seam', () => {
    expect(lerpWrapped(WORLD_W - 10, 10, 0.5)).toBe(0);
    expect(lerpWrapped(100, 200, 0.25)).toBe(125);
  });

  it('clamp bounds values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
