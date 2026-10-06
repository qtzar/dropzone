import { describe, it, expect } from 'vitest';
import { createCamera, updateCamera, CAMERA_LEAD } from '../../src/render/camera';
import { WORLD_W, shortestDx } from '../../src/core/world';

describe('camera', () => {
  it('eases toward the target plus a facing lead', () => {
    const cam = createCamera(1000);
    for (let i = 0; i < 600; i++) updateCamera(cam, 1000, 1, 1 / 60);
    expect(cam.lead).toBeCloseTo(CAMERA_LEAD, 0);
    expect(shortestDx(cam.x, 1000 + CAMERA_LEAD)).toBeCloseTo(0, 0);
  });

  it('leads the other way when facing left', () => {
    const cam = createCamera(1000);
    for (let i = 0; i < 600; i++) updateCamera(cam, 1000, -1, 1 / 60);
    expect(cam.lead).toBeCloseTo(-CAMERA_LEAD, 0);
  });

  it('follows across the world seam the short way', () => {
    const cam = createCamera(WORLD_W - 50);
    updateCamera(cam, 50, 1, 1 / 60);
    // moved forward across the seam rather than backwards across the world
    const moved = shortestDx(WORLD_W - 50, cam.x);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(400);
  });
});
