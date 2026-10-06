import { WORLD_W, wrapX, shortestDx, clamp } from '../core/world';
import { type Rng, range } from '../core/rng';
import { BASE_WIDTH } from './constants';

export const TERRAIN_STEP = 32;
export const TERRAIN_SAMPLES = WORLD_W / TERRAIN_STEP;
export const GROUND_MIN_Y = 560;
export const GROUND_MAX_Y = 680;
export const BASE_GROUND_Y = 640;

/**
 * Ground heights (world y, larger = lower) sampled every TERRAIN_STEP.
 * Uses whole-number sine frequencies over the world width so it wraps seamlessly.
 */
export function generateTerrain(rng: Rng, baseX: number): number[] {
  const mid = (GROUND_MIN_Y + GROUND_MAX_Y) / 2;
  const waves = [
    { k: 3, amp: 28, phase: range(rng, 0, Math.PI * 2) },
    { k: 11, amp: 16, phase: range(rng, 0, Math.PI * 2) },
    { k: 29, amp: 8, phase: range(rng, 0, Math.PI * 2) },
  ];
  const out: number[] = [];
  for (let i = 0; i < TERRAIN_SAMPLES; i++) {
    const x = i * TERRAIN_STEP;
    let h = mid + range(rng, -3, 3);
    for (const w of waves) h += w.amp * Math.sin((Math.PI * 2 * w.k * x) / WORLD_W + w.phase);
    out.push(clamp(h, GROUND_MIN_Y, GROUND_MAX_Y));
  }
  // Flatten under the base pad (one extra sample each side so interpolation stays flat).
  const flatHalf = BASE_WIDTH / 2 + TERRAIN_STEP;
  for (let i = 0; i < TERRAIN_SAMPLES; i++) {
    if (Math.abs(shortestDx(baseX, i * TERRAIN_STEP)) <= flatHalf) out[i] = BASE_GROUND_Y;
  }
  return out;
}

export function groundYAt(terrain: number[], x: number): number {
  const wx = wrapX(x);
  const f = wx / TERRAIN_STEP;
  const i0 = Math.floor(f) % TERRAIN_SAMPLES;
  const i1 = (i0 + 1) % TERRAIN_SAMPLES;
  const t = f - Math.floor(f);
  return terrain[i0] + (terrain[i1] - terrain[i0]) * t;
}
