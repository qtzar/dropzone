import { WORLD_W, wrapX, shortestDx } from '../core/world';
import { type Rng, range } from '../core/rng';
import { TERRAIN_STEP, TERRAIN_SAMPLES } from './terrain';

export interface Volcano {
  /** World x of the crater (cone peak). */
  x: number;
  /** Seconds until the next eruption. */
  timer: number;
}

export interface Landscape {
  volcanoes: Volcano[];
  /** Centre x of the ionic lake. */
  lakeX: number;
  /** Centre x of each lava ditch. */
  ditches: number[];
  /** Centre x of each decorative crater. */
  craters: number[];
}

export const VOLCANO_COUNT = 5;
export const VOLCANO_MIN_GAP = 1200;
export const VOLCANO_BASE_CLEAR = 600;
export const VOLCANO_HEIGHT = 90;
export const VOLCANO_WIDTH = 260;
export const LAKE_WIDTH = 360;
export const LAKE_BASE_CLEAR = 1500;
export const DITCH_COUNT = 3;
export const DITCH_WIDTH = 64;
export const DITCH_DEPTH = 30;
export const CRATER_COUNT = 4;
export const CRATER_WIDTH = 160;
export const CRATER_DEPTH = 18;
/** Gap kept between any two landscape features, and between a feature and the base pad. */
const FEATURE_MARGIN = 120;
const BASE_CLEAR_HALF = 200;
const PLACE_ATTEMPTS = 300;

/** Snaps a world x to the nearest terrain sample so features line up with the height samples. */
function snap(x: number): number {
  return wrapX(Math.round(x / TERRAIN_STEP) * TERRAIN_STEP);
}

interface Span { x: number; half: number }

function clearOf(spans: Span[], x: number, half: number): boolean {
  for (const sp of spans) {
    if (Math.abs(shortestDx(sp.x, x)) < sp.half + half + FEATURE_MARGIN) return false;
  }
  return true;
}

/** Random free spot at least `minBaseDist` from the base; falls back to a deterministic scan. */
function place(rng: Rng, spans: Span[], baseX: number, half: number, minBaseDist: number): number {
  const ok = (x: number) => Math.abs(shortestDx(baseX, x)) >= minBaseDist && clearOf(spans, x, half);
  for (let i = 0; i < PLACE_ATTEMPTS; i++) {
    const x = snap(range(rng, 0, WORLD_W));
    if (ok(x)) return x;
  }
  for (let x = 0; x < WORLD_W; x += TERRAIN_STEP) if (ok(x)) return x;
  return snap(baseX + WORLD_W / 2);
}

export function generateLandscape(rng: Rng, baseX: number): Landscape {
  // Volcanoes: one per slot along the arc that avoids the base, jittered inside the slot.
  const arcStart = VOLCANO_BASE_CLEAR + 130;
  const slot = (WORLD_W - 2 * VOLCANO_BASE_CLEAR) / VOLCANO_COUNT;
  const jitter = slot - VOLCANO_MIN_GAP - 100;
  const volcanoes: Volcano[] = [];
  for (let i = 0; i < VOLCANO_COUNT; i++) {
    const x = snap(baseX + arcStart + i * slot + range(rng, 0, jitter));
    volcanoes.push({ x, timer: range(rng, 2.5, 4) });
  }
  const spans: Span[] = [{ x: baseX, half: BASE_CLEAR_HALF }];
  for (const v of volcanoes) spans.push({ x: v.x, half: VOLCANO_WIDTH / 2 });

  const lakeX = place(rng, spans, baseX, LAKE_WIDTH / 2, LAKE_BASE_CLEAR);
  spans.push({ x: lakeX, half: LAKE_WIDTH / 2 });

  const ditches: number[] = [];
  for (let i = 0; i < DITCH_COUNT; i++) {
    const x = place(rng, spans, baseX, DITCH_WIDTH / 2, BASE_CLEAR_HALF);
    ditches.push(x);
    spans.push({ x, half: DITCH_WIDTH / 2 });
  }

  const craters: number[] = [];
  for (let i = 0; i < CRATER_COUNT; i++) {
    const x = place(rng, spans, baseX, CRATER_WIDTH / 2, BASE_CLEAR_HALF);
    craters.push(x);
    spans.push({ x, half: CRATER_WIDTH / 2 });
  }
  return { volcanoes, lakeX, ditches, craters };
}

/** Carves the landscape features into the terrain height samples (mutates `terrain`). */
export function applyLandscape(terrain: number[], ls: Landscape): void {
  const lakeY = terrain[Math.round(ls.lakeX / TERRAIN_STEP) % TERRAIN_SAMPLES];
  for (let i = 0; i < TERRAIN_SAMPLES; i++) {
    const x = i * TERRAIN_STEP;
    for (const v of ls.volcanoes) {
      const d = Math.abs(shortestDx(v.x, x));
      if (d < VOLCANO_WIDTH / 2) terrain[i] -= VOLCANO_HEIGHT * (1 - d / (VOLCANO_WIDTH / 2));
    }
    // One extra sample each side so interpolation stays flat across the whole 360 px.
    if (Math.abs(shortestDx(ls.lakeX, x)) <= LAKE_WIDTH / 2 + TERRAIN_STEP) terrain[i] = lakeY;
    for (const c of ls.craters) {
      const d = Math.abs(shortestDx(c, x)) / (CRATER_WIDTH / 2);
      if (d < 1) terrain[i] += CRATER_DEPTH * (1 - d * d);
    }
    for (const dx of ls.ditches) {
      if (Math.abs(shortestDx(dx, x)) < TERRAIN_STEP / 2) terrain[i] += DITCH_DEPTH;
    }
  }
}

export function volcanoAt(ls: Landscape, x: number): Volcano | undefined {
  return ls.volcanoes.find((v) => Math.abs(shortestDx(v.x, x)) <= VOLCANO_WIDTH / 2);
}

export function isLake(ls: Landscape, x: number): boolean {
  return Math.abs(shortestDx(ls.lakeX, x)) <= LAKE_WIDTH / 2;
}

export function isLava(ls: Landscape, x: number): boolean {
  return ls.ditches.some((d) => Math.abs(shortestDx(d, x)) <= DITCH_WIDTH / 2);
}
