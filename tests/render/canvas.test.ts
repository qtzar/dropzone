import { describe, it, expect } from 'vitest';
import { computeLetterbox } from '../../src/render/canvas';

describe('computeLetterbox', () => {
  it('fits 16:9 exactly', () => {
    expect(computeLetterbox(1920, 1080)).toEqual({ scale: 1.5, offsetX: 0, offsetY: 0 });
  });

  it('pillarboxes wide windows', () => {
    const r = computeLetterbox(2560, 720);
    expect(r.scale).toBe(1);
    expect(r.offsetX).toBe(640);
    expect(r.offsetY).toBe(0);
  });

  it('letterboxes tall windows', () => {
    const r = computeLetterbox(1280, 1000);
    expect(r.scale).toBe(1);
    expect(r.offsetX).toBe(0);
    expect(r.offsetY).toBe(140);
  });
});
