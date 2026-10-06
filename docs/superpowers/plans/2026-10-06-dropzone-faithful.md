# Dropzone Phase 2 (Faithful to the Original) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the remake follow the 1984 original: its enemy roster (Planter, Android, Nemesite, Spore, Trailer, Blunderstorm, Nmeye, Antimatter), the Io landscape (volcanoes, ionic lake, lava ditches, craters), men who walk to the base, the original wave structure, scoring, bombs and shield, while keeping Phase 1's engine, neon look, controls and modern extras.

**Architecture:** Phase 1 systems evolve in place (no new behaviour framework). The deterministic headless simulation (`src/game`) gains a landscape model, a hazards system (magma, acid, proton bolts, Nmeye bombs), a volcano system, and an AI folder (`src/game/systems/ai/`) with one file per enemy family. The new roster is added *alongside* the Phase 1 enemies first, so the game keeps running after every task; Task 10 switches wave spawning to the new roster and Task 11 deletes Snatcher, Orb/fragment, Hunter and trails.

**Tech Stack:** TypeScript (strict, `noUnusedLocals`, `noFallthroughCasesInSwitch`), Vite, Vitest, Canvas 2D, Web Audio API. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-dropzone-faithful-design.md`
**Branch:** `feature/dropzone-faithful` (already checked out; the spec is committed on it).

## Global Constraints

Still binding from Phase 1:

- No runtime dependencies. Dev dependencies are exactly `typescript`, `vite`, `vitest`.
- Internal resolution 1280×720 (`VIEW_W`, `VIEW_H`). World width = 8 × 1280 = 10,240 (`WORLD_W`), wrapping horizontally. No vertical scrolling.
- Simulation runs at 120 Hz (`SIM_DT = 1/120`). Frame `dt` is clamped to 0.25 s.
- `src/game/**`, `src/core/world.ts`, `src/core/rng.ts` must never reference `window`, `document`, canvas, or audio APIs. All randomness in game logic goes through `src/core/rng.ts` using `state.rng` (never `Math.random()` in `src/game`). The simulation must stay deterministic for a given seed.
- All horizontal distance/position math goes through `wrapX` / `shortestDx` in `src/core/world.ts`.
- No image or audio asset files. All graphics are drawn from code; all sound is synthesized.
- No `shadowBlur` in per-frame drawing code. It is only allowed in `src/render/sprites.ts` when pre-rendering sprites.
- localStorage key: `dropzone.v1`. Every access is wrapped in try/catch.
- Tests live in `tests/` mirroring `src/` paths, use explicit `import { describe, it, expect } from 'vitest'`, and run with `npm test`.
- Every commit message ends with these trailer lines (the commit commands below omit them for brevity; always append them):

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01HJhVpwkACTGNcJBCncVbeU
  ```

Phase 2 decisions (from the spec):

- Title credit text, verbatim: `BASED ON DROPZONE (1984) BY ARCHER MACLEAN - ARENA GRAPHICS / U.S. GOLD`, plus `AN UNOFFICIAL FAN TRIBUTE`.
- Keep every modern extra: combo multiplier (applies on top of the original kill values), hit-stop, popups, particles, slow-mo, screen shake.
- Controls are unchanged from Phase 1 (keyboard + gamepad). The original's "any key cloaks" is NOT adopted.
- Men reaching the base unaided are rescued with no points; carrying them earns the rescue bonus.
- `EnemyKind` ends up exactly `'planter' | 'android' | 'nemesite' | 'spore' | 'trailer' | 'blunderstorm' | 'nmeye' | 'antimatter'`.
- **Every task must leave `npm test && npm run typecheck` green and the game runnable (`npm run dev`).**
- Code for every task below was verified green in a scratch clone, task by task, in the order given. Apply the edits exactly; when a step says "Replace … with …", the *Replace* block matches the current file text exactly once. Do not reformat surrounding code.

## Interpretations of vague spec points (binding for all tasks)

- The `GameState.bombs` field already counts smart bombs, so the Nmeye bomb hazard list is named `eyeBombs` (type `EyeBomb`).
- Planter "release": the only release is the Planter being killed while lowering (its Android then falls). A Planter never releases its Android for any other reason; when the Android lands or dies, the Planter converts to a Nemesite.
- A man becomes `chased` (and whistles) the moment a Planter starts lowering an Android onto him. A chased man keeps walking and can still be picked up; he returns to `walking` when his Android dies, converts or loses him. `Man.holderId` holds the chasing Android's id.
- Men at the lake or a lava-ditch edge turn round and walk *away* for 1–2 s (`walkTimer`), then head for the base again.
- Self-rescued men count in `savedThisWave` (they are survivors), so they count toward the end-of-wave bonus; only the carried-delivery bonus is withheld.
- End-of-wave bonus per survivor = min(500, 100 × wave), times the combo multiplier (mirrors the delivery bonus; "× wave" alone would be a few points).
- Trailer head-hit rule for horizontal lasers: the laser hits the half facing the laser's origin; that is the front half when `sign(laser.vx) * trailer.vx <= 0` (Trailer flying toward the laser, or with no horizontal speed).
- A Spore releases its 4 Trailers on the four diagonals (45°, 135°, 225°, 315°).
- Wave 100+ plays as 95, 96, 97, 98, 99, 95, … via `effectiveWave()`; invasions, shipments, tuning and bonuses all use the effective wave; the displayed `s.wave` keeps counting.
- Shield: `shieldBank` starts at 7 in `createGameState`; `startWave` adds 7 for every wave after wave 1.
- Spawning switches to the new roster only in Task 10, so Planters, Spores and Blunderstorms appear in normal play from Task 10 on (the Nmeye appears from Task 6). Earlier tasks wire behaviour, rendering and audio so it is live as soon as the enemy exists.

## File Map

| File | Responsibility | Tasks |
|---|---|---|
| `src/game/landscape.ts` (new) | Volcano/lake/ditch/crater placement, carving into terrain, `volcanoAt`/`isLake`/`isLava` | 1 |
| `src/game/state.ts` | `GameState` (+ `landscape`, hazard lists, `shieldBank`, `survivors`, `unstable`), new `Enemy` fields, `ManState` | 1, 2, 6, 9, 11, 12 |
| `src/game/constants.ts` | All new tuning constants | 2–12 |
| `src/game/events.ts` | New `GameEvent` variants | 2, 9, 11 |
| `src/game/entities/enemies.ts` | `ENEMY_STATS` for the new roster, `createEnemy` defaults, `startOrbit`, `killPoints` | 2, 5, 11 |
| `src/game/systems/hazards.ts` (new) | Magma/acid/bolt/eye-bomb movement, expiry, player collision, clearing | 3 |
| `src/game/systems/volcanoes.ts` (new) | Magma lobbing, white-hot mode | 4 |
| `src/game/systems/ai/index.ts` (moved from `ai.ts`) | Integrate, enemy fire, shots, per-kind dispatch | 5–8, 11 |
| `src/game/systems/ai/common.ts` (new) | `playerVisible`, `homeOnPlayer` | 5 |
| `src/game/systems/ai/planter.ts` (new) | Planter + Android | 5 |
| `src/game/systems/ai/homers.ts` (new) | Nemesite, Nmeye, Antimatter | 6 |
| `src/game/systems/ai/spawners.ts` (new) | Spore release, Trailer, head-hit rule | 7 |
| `src/game/systems/ai/storm.ts` (new) | Blunderstorm acid + proton bolt | 8 |
| `src/game/systems/combat.ts` | Android drop, falling-Android points, Spore release, head-hit, death penalty | 5–7, 11, 12 |
| `src/game/systems/rescue.ts` | Men walk to base, turn at lake/lava, self-rescue, delivery bonus, lava death, `checkUnstable` | 5, 9, 11 |
| `src/game/tuning.ts` | New composition table, `effectiveWave`, invasion/shipment helpers | 10 |
| `src/game/systems/waves.ts` | Nmeye timer, roster spawning, invasions, shipments, survivors, wave-end rule, bonus | 3, 6, 9, 10, 12 |
| `src/game/systems/scoring.ts` | +life +bomb every 10,000 up to 1,000,000 | 12 |
| `src/game/systems/powerups.ts` | Shield bank, Strata Bomb rules | 12 |
| `src/game/update.ts` | Wiring and final ordering | 3, 4, 9, 11, 14 |
| `src/render/background.ts` | Landscape drawing | 1, 9 |
| `src/render/renderer.ts` | Hazards, tethers, "!", Nmeye flash, Antimatter spin, Trailer tail | 1, 3, 5, 6, 7, 9, 11 |
| `src/render/sprites.ts`, `src/render/palette.ts` | Sprites/colours for the new roster and hazards | 1, 2, 3, 6, 11 |
| `src/render/hud.ts` | Scanner base cross, shield text, 9 bombs, wave/invasion banner | 1, 9, 11, 12, 13 |
| `src/render/effects.ts` | Effects for the new events, earthquake shake | 4, 6, 7, 9, 11, 12, 13 |
| `src/render/debug.ts` | Debug overlay fields | 9, 11, 14 |
| `src/audio/sfx.ts`, `src/audio/eventAudio.ts` | New SFX + event mapping, quake loop | 6, 9, 11, 13 |
| `src/scenes/screens.ts`, `src/scenes/app.ts` | Credit text, quake loop + positional audio filter | 9, 11, 13 |
| `tests/game/helpers.ts` | Unchanged: `addMan`, `addEnemy` are reused as-is | — |

---

### Task 1: Io landscape: volcanoes, ionic lake, lava ditches, craters

Generate the landscape from the seed right after the terrain, carve it into the terrain height samples (so `groundYAt` stays the single source of ground height), store it in `GameState.landscape`, draw it, and draw the base as a white cross on the scanner.

Placement rules (spec §2): 5 volcanoes at least 1200 apart and at least 600 from the base, each a cone raised 90 px over 260 px with the crater at its peak; one 360 px ionic lake at least 1500 from the base, flattened to one height; 3 lava ditches 64 px wide and 30 px deep; 4 decorative craters. Feature centres are snapped to terrain samples (`TERRAIN_STEP` = 32). Volcanoes go one per slot along the arc that avoids the base (slot = (10240 − 1200)/5 = 1808, jitter 0–508), which guarantees the spacing rules; the other features use seeded rejection sampling with a 120 px gap between features and a deterministic scan fallback.

**Files:**
- Modify: `src/game/state.ts`
- Create: `src/game/landscape.ts`
- Modify: `src/render/background.ts`
- Modify: `src/render/hud.ts`
- Modify: `src/render/palette.ts`
- Modify: `src/render/renderer.ts`
- Test (create): `tests/game/landscape.test.ts`

**Interfaces:**
- Consumes: `Rng`, `range` (`src/core/rng.ts`); `WORLD_W`, `wrapX`, `shortestDx` (`src/core/world.ts`); `TERRAIN_STEP`, `TERRAIN_SAMPLES`, `generateTerrain`, `groundYAt` (`src/game/terrain.ts`).
- Produces:
  - `src/game/landscape.ts`:
    - `interface Volcano { x: number; timer: number }` (`timer` = seconds to next eruption, initialised 2.5–4; used by Task 4)
    - `interface Landscape { volcanoes: Volcano[]; lakeX: number; ditches: number[]; craters: number[] }`
    - constants `VOLCANO_COUNT = 5`, `VOLCANO_MIN_GAP = 1200`, `VOLCANO_BASE_CLEAR = 600`, `VOLCANO_HEIGHT = 90`, `VOLCANO_WIDTH = 260`, `LAKE_WIDTH = 360`, `LAKE_BASE_CLEAR = 1500`, `DITCH_COUNT = 3`, `DITCH_WIDTH = 64`, `DITCH_DEPTH = 30`, `CRATER_COUNT = 4`, `CRATER_WIDTH = 160`, `CRATER_DEPTH = 18`
    - `generateLandscape(rng: Rng, baseX: number): Landscape`
    - `applyLandscape(terrain: number[], ls: Landscape): void` (mutates terrain)
    - `volcanoAt(ls: Landscape, x: number): Volcano | undefined` (within `VOLCANO_WIDTH/2`)
    - `isLake(ls: Landscape, x: number): boolean` (within `LAKE_WIDTH/2`)
    - `isLava(ls: Landscape, x: number): boolean` (within `DITCH_WIDTH/2` of a ditch)
  - `GameState.landscape: Landscape`
  - `Background.drawLandscape(ctx, ls: Landscape, terrain: number[], camX: number, time: number, whiteHot: boolean): void`
  - `PALETTE.magma`, `PALETTE.hotRock`, `PALETTE.lake`

- [ ] **Step 1: Write the failing tests**

Create `tests/game/landscape.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { shortestDx } from '../../src/core/world';
import { generateTerrain, groundYAt } from '../../src/game/terrain';
import { createGameState } from '../../src/game/state';
import {
  generateLandscape, applyLandscape, volcanoAt, isLake, isLava,
  VOLCANO_COUNT, VOLCANO_MIN_GAP, VOLCANO_BASE_CLEAR, VOLCANO_HEIGHT, VOLCANO_WIDTH,
  LAKE_WIDTH, LAKE_BASE_CLEAR, DITCH_COUNT, DITCH_WIDTH, DITCH_DEPTH, CRATER_COUNT,
} from '../../src/game/landscape';

const BASE = 640;

describe('generateLandscape placement', () => {
  for (const seed of [1, 2, 3, 42, 777, 9999]) {
    it(`obeys the spacing rules (seed ${seed})`, () => {
      const ls = generateLandscape(createRng(seed), BASE);
      expect(ls.volcanoes).toHaveLength(VOLCANO_COUNT);
      expect(ls.ditches).toHaveLength(DITCH_COUNT);
      expect(ls.craters).toHaveLength(CRATER_COUNT);
      for (let i = 0; i < ls.volcanoes.length; i++) {
        const v = ls.volcanoes[i];
        expect(Math.abs(shortestDx(BASE, v.x))).toBeGreaterThanOrEqual(VOLCANO_BASE_CLEAR);
        expect(v.timer).toBeGreaterThanOrEqual(2.5);
        expect(v.timer).toBeLessThanOrEqual(4);
        for (let j = i + 1; j < ls.volcanoes.length; j++) {
          expect(Math.abs(shortestDx(v.x, ls.volcanoes[j].x))).toBeGreaterThanOrEqual(VOLCANO_MIN_GAP);
        }
      }
      expect(Math.abs(shortestDx(BASE, ls.lakeX))).toBeGreaterThanOrEqual(LAKE_BASE_CLEAR);
      // No feature overlaps another one.
      const spans = [
        ...ls.volcanoes.map((v) => ({ x: v.x, half: VOLCANO_WIDTH / 2 })),
        { x: ls.lakeX, half: LAKE_WIDTH / 2 },
        ...ls.ditches.map((x) => ({ x, half: DITCH_WIDTH / 2 })),
        ...ls.craters.map((x) => ({ x, half: 80 })),
      ];
      for (let i = 0; i < spans.length; i++) {
        for (let j = i + 1; j < spans.length; j++) {
          expect(Math.abs(shortestDx(spans[i].x, spans[j].x))).toBeGreaterThan(spans[i].half + spans[j].half);
        }
      }
    });
  }

  it('is deterministic for a seed', () => {
    expect(generateLandscape(createRng(5), BASE)).toEqual(generateLandscape(createRng(5), BASE));
  });
});

describe('applyLandscape and groundYAt', () => {
  const rng = createRng(1);
  const flat = generateTerrain(rng, BASE);
  const ls = generateLandscape(rng, BASE);
  const terrain = flat.slice();
  applyLandscape(terrain, ls);

  it('raises each volcano cone 90 px at its peak', () => {
    for (const v of ls.volcanoes) {
      expect(groundYAt(terrain, v.x)).toBeCloseTo(groundYAt(flat, v.x) - VOLCANO_HEIGHT);
      expect(groundYAt(terrain, v.x + VOLCANO_WIDTH / 2 + 40)).toBeCloseTo(groundYAt(flat, v.x + VOLCANO_WIDTH / 2 + 40));
    }
  });

  it('flattens the lake to a single height', () => {
    const y0 = groundYAt(terrain, ls.lakeX);
    for (let dx = -LAKE_WIDTH / 2; dx <= LAKE_WIDTH / 2; dx += 16) {
      expect(groundYAt(terrain, ls.lakeX + dx)).toBeCloseTo(y0);
    }
  });

  it('dips 30 px at each lava ditch', () => {
    for (const d of ls.ditches) {
      expect(groundYAt(terrain, d)).toBeCloseTo(groundYAt(flat, d) + DITCH_DEPTH);
    }
  });

  it('createGameState stores the landscape and carves it into the terrain', () => {
    const s = createGameState(1);
    expect(s.landscape).toEqual(ls);
    expect(s.terrain).toEqual(terrain);
  });
});

describe('landscape queries', () => {
  const ls = { volcanoes: [{ x: 2000, timer: 3 }], lakeX: 5000, ditches: [7000], craters: [8000] };

  it('volcanoAt finds the volcano under a world x', () => {
    expect(volcanoAt(ls, 2000)).toBe(ls.volcanoes[0]);
    expect(volcanoAt(ls, 2000 + VOLCANO_WIDTH / 2)).toBe(ls.volcanoes[0]);
    expect(volcanoAt(ls, 2000 + VOLCANO_WIDTH / 2 + 1)).toBeUndefined();
  });

  it('isLake covers the 360 px stretch', () => {
    expect(isLake(ls, 5000 - LAKE_WIDTH / 2)).toBe(true);
    expect(isLake(ls, 5000 + LAKE_WIDTH / 2)).toBe(true);
    expect(isLake(ls, 5000 + LAKE_WIDTH / 2 + 1)).toBe(false);
  });

  it('isLava covers each 64 px ditch', () => {
    expect(isLava(ls, 7000 + DITCH_WIDTH / 2)).toBe(true);
    expect(isLava(ls, 7000 - DITCH_WIDTH / 2 - 1)).toBe(false);
    expect(isLava(ls, 3000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/game/landscape.test.ts`
Expected: FAIL: `tests/game/landscape.test.ts` cannot resolve `../../src/game/landscape`.

- [ ] **Step 3: Implement**

Edit `src/game/state.ts` (4 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { type Rng, createRng } from '../core/rng';
import type { GameEvent } from './events';
import { generateTerrain } from './terrain';
import { START_LIVES, START_BOMBS, EXTRA_LIFE_EVERY, MEN_PER_WAVE, CEILING_Y } from './constants';

export type Facing = 1 | -1;
```

   with:

```ts
import { type Rng, createRng } from '../core/rng';
import type { GameEvent } from './events';
import { generateTerrain } from './terrain';
import { generateLandscape, applyLandscape, type Landscape } from './landscape';
import { START_LIVES, START_BOMBS, EXTRA_LIFE_EVERY, MEN_PER_WAVE, CEILING_Y } from './constants';

export type Facing = 1 | -1;
```

2. Replace:

```ts
  phaseTimer: number;
  baseX: number;
  terrain: number[];
  player: Player;
  men: Man[];
  enemies: Enemy[];
```

   with:

```ts
  phaseTimer: number;
  baseX: number;
  terrain: number[];
  landscape: Landscape;
  player: Player;
  men: Man[];
  enemies: Enemy[];
```

3. Replace:

```ts
export function createGameState(seed: number): GameState {
  const rng = createRng(seed);
  const terrain = generateTerrain(rng, BASE_X);
  const startY = CEILING_Y + 200;
  return {
    seed,
```

   with:

```ts
export function createGameState(seed: number): GameState {
  const rng = createRng(seed);
  const terrain = generateTerrain(rng, BASE_X);
  const landscape = generateLandscape(rng, BASE_X);
  applyLandscape(terrain, landscape);
  const startY = CEILING_Y + 200;
  return {
    seed,
```

4. Replace:

```ts
    phaseTimer: 0,
    baseX: BASE_X,
    terrain,
    player: {
      x: BASE_X,
      y: startY,
```

   with:

```ts
    phaseTimer: 0,
    baseX: BASE_X,
    terrain,
    landscape,
    player: {
      x: BASE_X,
      y: startY,
```

Create `src/game/landscape.ts`:

```ts
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
```

Edit `src/render/background.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { createRng, range } from '../core/rng';
import { groundYAt, TERRAIN_STEP, BASE_GROUND_Y } from '../game/terrain';
import { BASE_WIDTH } from '../game/constants';
import { PALETTE } from './palette';

interface Star { x: number; y: number; size: number; alpha: number }
```

   with:

```ts
import { createRng, range } from '../core/rng';
import { groundYAt, TERRAIN_STEP, BASE_GROUND_Y } from '../game/terrain';
import { BASE_WIDTH } from '../game/constants';
import {
  type Landscape, VOLCANO_WIDTH, LAKE_WIDTH, DITCH_WIDTH, CRATER_WIDTH,
} from '../game/landscape';
import { PALETTE } from './palette';

interface Star { x: number; y: number; size: number; alpha: number }
```

2. Replace:

```ts
    ctx.stroke();
  }

  drawBase(ctx: CanvasRenderingContext2D, baseX: number, camX: number, time: number): void {
    const sx = toScreenX(baseX, camX);
    if (sx < -300 || sx > VIEW_W + 300) return;
```

   with:

```ts
    ctx.stroke();
  }

  /** Volcano craters, the ionic lake and lava ditches, drawn over the terrain ridge. */
  drawLandscape(ctx: CanvasRenderingContext2D, ls: Landscape, terrain: number[], camX: number, time: number, whiteHot: boolean): void {
    const visible = (x: number, half: number) => {
      const sx = toScreenX(x, camX);
      return sx > -half - 40 && sx < VIEW_W + half + 40 ? sx : null;
    };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Decorative craters: a faint inner arc.
    ctx.strokeStyle = PALETTE.terrain;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    for (const c of ls.craters) {
      const sx = visible(c, CRATER_WIDTH / 2);
      if (sx === null) continue;
      const y = groundYAt(terrain, c);
      ctx.beginPath();
      ctx.ellipse(sx, y - 4, CRATER_WIDTH * 0.35, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Volcano craters: a glow at each peak (white when the planet is unstable).
    for (const v of ls.volcanoes) {
      const sx = visible(v.x, VOLCANO_WIDTH / 2);
      if (sx === null) continue;
      const y = groundYAt(terrain, v.x);
      const pulse = 0.6 + 0.4 * Math.sin(time * 3 + v.x);
      const g = ctx.createRadialGradient(sx, y, 2, sx, y, 46);
      g.addColorStop(0, whiteHot ? 'rgba(255,255,255,0.9)' : 'rgba(255,170,60,0.85)');
      g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.globalAlpha = pulse;
      ctx.fillStyle = g;
      ctx.fillRect(sx - 46, y - 46, 92, 92);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = whiteHot ? PALETTE.hotRock : PALETTE.magma;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - 10, y + 2);
      ctx.lineTo(sx + 10, y + 2);
      ctx.stroke();
    }

    // Ionic lake: a shimmering liquid surface.
    const lx = visible(ls.lakeX, LAKE_WIDTH / 2);
    if (lx !== null) {
      const y = groundYAt(terrain, ls.lakeX);
      ctx.fillStyle = 'rgba(40,220,255,0.18)';
      ctx.fillRect(lx - LAKE_WIDTH / 2, y, LAKE_WIDTH, 14);
      ctx.strokeStyle = PALETTE.lake;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let dx = -LAKE_WIDTH / 2; dx <= LAKE_WIDTH / 2; dx += 8) {
        const wy = y + Math.sin(time * 4 + dx * 0.08) * 1.5;
        if (dx === -LAKE_WIDTH / 2) ctx.moveTo(lx + dx, wy);
        else ctx.lineTo(lx + dx, wy);
      }
      ctx.stroke();
    }

    // Lava ditches: a glowing pool in each dip.
    for (const d of ls.ditches) {
      const sx = visible(d, DITCH_WIDTH / 2);
      if (sx === null) continue;
      const y = groundYAt(terrain, d);
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 6 + d);
      ctx.fillStyle = PALETTE.magma;
      ctx.beginPath();
      ctx.moveTo(sx - DITCH_WIDTH / 4, y - 14);
      ctx.lineTo(sx + DITCH_WIDTH / 4, y - 14);
      ctx.lineTo(sx, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawBase(ctx: CanvasRenderingContext2D, baseX: number, camX: number, time: number): void {
    const sx = toScreenX(baseX, camX);
    if (sx < -300 || sx > VIEW_W + 300) return;
```

Edit `src/render/hud.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  }
  ctx.stroke();

  // Base
  const b = scannerPos(s.baseX, VIEW_H - 40, camX);
  blip(ctx, b, PALETTE.base, 6);

  for (const m of s.men) {
    if (m.state === 'saved' || m.state === 'dead') continue;
```

   with:

```ts
  }
  ctx.stroke();

  // Base: a white cross
  const b = scannerPos(s.baseX, VIEW_H - 40, camX);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(b.x - 4, b.y - 1, 8, 2);
  ctx.fillRect(b.x - 1, b.y - 4, 2, 8);

  for (const m of s.men) {
    if (m.state === 'saved' || m.state === 'dead') continue;
```

Replace the whole content of `src/render/palette.ts` with:

```ts
import type { ExplosionSource } from '../game/events';

export const PALETTE = {
  player: '#22e6ff',
  man: '#4dff88',
  snatcher: '#ff3df2',
  nemesite: '#ff3b3b',
  trailer: '#ff9a1f',
  orb: '#a46bff',
  fragment: '#c99bff',
  hunter: '#ffe066',
  base: '#19e3c3',
  laser: '#9ff6ff',
  shot: '#ff6a6a',
  terrain: '#3d7bff',
  terrainCritical: '#ff3b5c',
  magma: '#ff7a1a',
  hotRock: '#fff3c4',
  lake: '#3ff0ff',
  hud: '#9ad8ff',
  text: '#e8f6ff',
  warn: '#ff4d6d',
} as const;

export function explosionColor(source: ExplosionSource): string {
  return PALETTE[source];
}
```

Edit `src/render/renderer.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
    this.bg.drawStars(ctx, cam.x);
    this.bg.drawMountains(ctx, cam.x, s.critical);
    this.bg.drawTerrain(ctx, s.terrain, cam.x, s.critical);
    this.bg.drawBase(ctx, s.baseX, cam.x, s.time);

    this.drawTrails(ctx, s, cam.x);
```

   with:

```ts
    this.bg.drawStars(ctx, cam.x);
    this.bg.drawMountains(ctx, cam.x, s.critical);
    this.bg.drawTerrain(ctx, s.terrain, cam.x, s.critical);
    this.bg.drawLandscape(ctx, s.landscape, s.terrain, cam.x, s.time, s.critical);
    this.bg.drawBase(ctx, s.baseX, cam.x, s.time);

    this.drawTrails(ctx, s, cam.x);
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 223 tests pass, no type errors.

- [ ] **Step 5: Browser check**

Run `npm run dev`, press Enter, fly left and right: glowing volcano craters on raised cones, a cyan shimmering lake surface on a flat stretch, three small orange lava pools in V-shaped dips, faint crater ellipses; the scanner shows the base as a white cross.

- [ ] **Step 6: Commit**

```bash
git add -A src/game/landscape.ts src/game/state.ts src/render/background.ts src/render/hud.ts src/render/palette.ts src/render/renderer.ts tests/game/landscape.test.ts
git commit -m "feat: generate the Io landscape (volcanoes, lake, lava ditches, craters)"
```

---

### Task 2: State, events, stats, palette and sprites for the new roster (additive)

Add the eight original enemy kinds *alongside* the Phase 1 kinds, the new enemy fields, hazard lists, `shieldBank`, `survivors`, the `chased` man state and the new events. `ENEMY_STATS`, `PALETTE` and the sprite record are `Record<EnemyKind, …>` maps, so they are extended in this same task. Nothing spawns the new kinds yet; existing behaviour is unchanged except that Nemesites now use the original values (150 points, speed 260) and half of all Trailers get `homer = true` (not used until Task 7).

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/state.ts`
- Modify: `src/game/events.ts`
- Modify: `src/game/entities/enemies.ts`
- Modify: `src/render/palette.ts`
- Modify: `src/render/sprites.ts`
- Test (modify): `tests/game/entities/enemies.test.ts`
- Test (modify): `tests/game/state.test.ts`
- Test (create): `tests/render/palette.test.ts`

**Interfaces:**
- Consumes: `createGameState`, `allocId`, `Enemy`, `EnemyKind`, `Facing` (`src/game/state.ts`); `range`, `chance`; `wrapX`; `makeSprite`, `poly`, `line`, `circle` helpers inside `src/render/sprites.ts`.
- Produces:
  - `EnemyKind` = `'snatcher' | 'orb' | 'fragment' | 'hunter' | 'planter' | 'android' | 'nemesite' | 'spore' | 'trailer' | 'blunderstorm' | 'nmeye' | 'antimatter'` (old four removed in Task 11)
  - `ManState` adds `'chased'`
  - `Enemy` adds: `linkedId: number | null`, `tetherLen: number`, `dodgeTimer: number`, `dodgeDir: Facing`, `warned: boolean`, `homer: boolean`, `falling: boolean`, `orbitAngle: number`, `orbitX: number`, `orbitY: number`, `actionTimer: number`, `bombTimer: number`, `boltTimer: number`
  - Hazard types `Magma { x; y; vx; vy; r; hot: boolean }`, `Acid { x; y; vy }`, `Bolt { x; top; bottom; life }`, `EyeBomb { x; y; vy }` (all numbers unless noted)
  - `GameState` adds `magma: Magma[]`, `acid: Acid[]`, `bolts: Bolt[]`, `eyeBombs: EyeBomb[]`, `shieldBank: number` (= `SHIELD_START` = 7), `survivors: number` (= `MEN_PER_WAVE`)
  - `GameEvent` adds `manWhistle {x,y}`, `manSelfRescued {x,y}`, `nemesiteWarning {x,y}`, `rumble {x,y}`, `protonBolt {x, top, bottom}`, `volcanoErupt {x, y, whiteHot: boolean}`, `planetUnstable`, `invasionWave {wave}`, `nmeyeSpawned {x,y}`, `laserBlocked {x,y}`
  - Constants: `SHIELD_START`, `PLANTER_CRUISE_MIN = 220`, `PLANTER_CRUISE_MAX = 380`, `STORM_BAND_TOP = CEILING_Y + 20`, `STORM_BAND_BOTTOM = CEILING_Y + 80`, `STORM_ACTION_MIN = 3`, `STORM_ACTION_MAX = 5`, `TRAILER_HOMER_CHANCE = 0.5`, `NMEYE_BOMB_INTERVAL = 0.6`, `ANTIMATTER_ORBIT_RADIUS = 80`
  - `ENEMY_STATS` entries: planter {15, 250, 90, 2}, android {9, 50, 29, 0}, nemesite {13, 150, 260, 0.6}, spore {14, 750, 50, 0}, trailer {14, 250, 200, 1.5}, blunderstorm {24, 250, 40, 0}, nmeye {14, 100, 760, 0}, antimatter {12, 150, 160, 0} as {radius, points, speed, fireMult}
  - `startOrbit(e: Enemy): void` in `enemies.ts` (puts an Antimatter on its orbit: centre 80 px to its left, angle 0)
  - `createEnemy` kind defaults: planter cruise height 220–380 (overrides `y`) and drifts ±speed; spore random direction at speed; blunderstorm in the upper band with `actionTimer` 3–5; trailer `homer` 50%; nmeye `bombTimer = 0.6`; antimatter `startOrbit`
  - `convertEnemy` also clears `linkedId`, `tetherLen`, `falling`, `dodgeTimer`
  - `PALETTE.planter/android/spore/blunderstorm/nmeye/antimatter` and a glow sprite for each

- [ ] **Step 1: Write the failing tests**

Replace the whole content of `tests/game/entities/enemies.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import {
  ENEMY_STATS, createEnemy, fireInterval, convertEnemy, makeAggressive, AGGRESSIVE_SPEED_MULT,
} from '../../../src/game/entities/enemies';
import {
  PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX, STORM_BAND_TOP, STORM_BAND_BOTTOM, NMEYE_BOMB_INTERVAL, ANTIMATTER_ORBIT_RADIUS,
} from '../../../src/game/constants';

describe('enemies', () => {
  it('createEnemy applies stats and the wave speed scale', () => {
    const s = createGameState(1);
    s.speedScale = 1.5;
    const e = createEnemy(s, 'nemesite', 100, 200);
    expect(e.radius).toBe(ENEMY_STATS.nemesite.radius);
    expect(e.speed).toBeCloseTo(ENEMY_STATS.nemesite.speed * 1.5);
    expect(e.dead).toBe(false);
    expect(Number.isFinite(e.fireTimer)).toBe(true);
    expect(s.enemies).toHaveLength(0);
  });

  it('orbs and fragments never fire', () => {
    const s = createGameState(1);
    expect(createEnemy(s, 'orb', 0, 200).fireTimer).toBe(Infinity);
    expect(fireInterval(s, createEnemy(s, 'fragment', 0, 200))).toBe(Infinity);
  });

  it('orbs and trailers start moving', () => {
    const s = createGameState(1);
    const orb = createEnemy(s, 'orb', 0, 200);
    expect(Math.hypot(orb.vx, orb.vy)).toBeGreaterThan(0);
    expect(Math.abs(createEnemy(s, 'trailer', 0, 200).vx)).toBeGreaterThan(0);
  });

  it('convertEnemy changes kind and stats and clears snatcher state', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'snatcher', 0, 200);
    e.carryingId = 5;
    e.targetId = 6;
    convertEnemy(s, e, 'nemesite');
    expect(e.kind).toBe('nemesite');
    expect(e.radius).toBe(ENEMY_STATS.nemesite.radius);
    expect(e.carryingId).toBeNull();
    expect(e.targetId).toBeNull();
  });

  it('makeAggressive turns non-hunters into fast nemesites', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'orb', 0, 200);
    makeAggressive(s, e);
    expect(e.kind).toBe('nemesite');
    expect(e.aggressive).toBe(true);
    expect(e.speed).toBeCloseTo(ENEMY_STATS.nemesite.speed * AGGRESSIVE_SPEED_MULT);
    const h = createEnemy(s, 'hunter', 0, 200);
    makeAggressive(s, h);
    expect(h.kind).toBe('hunter');
    expect(h.speed).toBeCloseTo(ENEMY_STATS.hunter.speed * AGGRESSIVE_SPEED_MULT);
  });
});

describe('phase 2 roster stats', () => {
  it('matches the original point values', () => {
    expect(ENEMY_STATS.planter.points).toBe(250);
    expect(ENEMY_STATS.android.points).toBe(50);
    expect(ENEMY_STATS.nemesite.points).toBe(150);
    expect(ENEMY_STATS.spore.points).toBe(750);
    expect(ENEMY_STATS.trailer.points).toBe(250);
    expect(ENEMY_STATS.blunderstorm.points).toBe(250);
    expect(ENEMY_STATS.nmeye.points).toBe(100);
    expect(ENEMY_STATS.antimatter.points).toBe(150);
  });

  it('uses the spec speeds', () => {
    expect(ENEMY_STATS.nemesite.speed).toBe(260);
    expect(ENEMY_STATS.spore.speed).toBe(50);
    expect(ENEMY_STATS.nmeye.speed).toBe(760);
    expect(ENEMY_STATS.antimatter.speed).toBe(160);
  });

  it('uses the spec fire multipliers', () => {
    expect(ENEMY_STATS.planter.fireMult).toBe(2);
    expect(ENEMY_STATS.nemesite.fireMult).toBe(0.6);
    expect(ENEMY_STATS.trailer.fireMult).toBe(1.5);
    for (const k of ['android', 'spore', 'blunderstorm', 'nmeye', 'antimatter'] as const) {
      expect(ENEMY_STATS[k].fireMult).toBe(0);
    }
  });
});

describe('createEnemy phase 2 defaults', () => {
  it('fills the new fields with neutral defaults', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'android', 100, 500);
    expect(e.linkedId).toBeNull();
    expect(e.tetherLen).toBe(0);
    expect(e.dodgeTimer).toBe(0);
    expect(e.warned).toBe(false);
    expect(e.homer).toBe(false);
    expect(e.falling).toBe(false);
    expect(e.boltTimer).toBe(0);
    expect(e.fireTimer).toBe(Infinity);
  });

  it('planters cruise between 220 and 380 and drift horizontally', () => {
    const s = createGameState(1);
    for (let i = 0; i < 20; i++) {
      const e = createEnemy(s, 'planter', 100, 150);
      expect(e.homeY).toBeGreaterThanOrEqual(PLANTER_CRUISE_MIN);
      expect(e.homeY).toBeLessThanOrEqual(PLANTER_CRUISE_MAX);
      expect(e.y).toBe(e.homeY);
      expect(Math.abs(e.vx)).toBeCloseTo(e.speed);
    }
  });

  it('blunderstorms start in the upper band with a 3-5 s action timer', () => {
    const s = createGameState(1);
    for (let i = 0; i < 20; i++) {
      const e = createEnemy(s, 'blunderstorm', 100, 400);
      expect(e.y).toBeGreaterThanOrEqual(STORM_BAND_TOP);
      expect(e.y).toBeLessThanOrEqual(STORM_BAND_BOTTOM);
      expect(e.actionTimer).toBeGreaterThanOrEqual(3);
      expect(e.actionTimer).toBeLessThanOrEqual(5);
    }
  });

  it('spores drift at speed 50 in a random direction', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'spore', 100, 300);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(50);
  });

  it('about half of all trailers are homers', () => {
    const s = createGameState(1);
    let homers = 0;
    for (let i = 0; i < 400; i++) if (createEnemy(s, 'trailer', 100, 300).homer) homers++;
    expect(homers).toBeGreaterThan(150);
    expect(homers).toBeLessThan(250);
  });

  it('antimatter starts on its orbit at angle 0', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'antimatter', 1000, 300);
    expect(e.orbitAngle).toBe(0);
    expect(e.orbitX).toBe(1000 - ANTIMATTER_ORBIT_RADIUS);
    expect(e.orbitY).toBe(300);
  });

  it('nmeye starts with its bomb timer armed', () => {
    const s = createGameState(1);
    expect(createEnemy(s, 'nmeye', 0, 300).bombTimer).toBe(NMEYE_BOMB_INTERVAL);
  });

  it('convertEnemy clears planter/android links', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'planter', 0, 300);
    e.linkedId = 7;
    e.tetherLen = 50;
    convertEnemy(s, e, 'nemesite');
    expect(e.linkedId).toBeNull();
    expect(e.tetherLen).toBe(0);
    expect(e.radius).toBe(ENEMY_STATS.nemesite.radius);
  });
});
```

Replace the whole content of `tests/game/state.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState, allocId } from '../../src/game/state';
import { START_LIVES, START_BOMBS, EXTRA_LIFE_EVERY, MEN_PER_WAVE, SHIELD_START } from '../../src/game/constants';
import { groundYAt } from '../../src/game/terrain';

describe('createGameState', () => {
  it('creates a fresh game with starting resources', () => {
    const s = createGameState(123);
    expect(s.seed).toBe(123);
    expect(s.lives).toBe(START_LIVES);
    expect(s.bombs).toBe(START_BOMBS);
    expect(s.nextExtraLife).toBe(EXTRA_LIFE_EVERY);
    expect(s.score).toBe(0);
    expect(s.multiplier).toBe(1);
    expect(s.menRemaining).toBe(MEN_PER_WAVE);
    expect(s.phase).toBe('playing');
    expect(s.enemies).toEqual([]);
    expect(s.men).toEqual([]);
    expect(s.events).toEqual([]);
  });

  it('places the player above the base, alive and facing right', () => {
    const s = createGameState(1);
    expect(s.player.x).toBe(s.baseX);
    expect(s.player.y).toBeLessThan(groundYAt(s.terrain, s.baseX));
    expect(s.player.alive).toBe(true);
    expect(s.player.facing).toBe(1);
    expect(s.player.cloak).toBe(1);
    expect(s.player.carryingId).toBeNull();
  });

  it('starts with empty hazard lists, a 7 s shield bank and 8 survivors to deploy', () => {
    const s = createGameState(1);
    expect(s.magma).toEqual([]);
    expect(s.acid).toEqual([]);
    expect(s.bolts).toEqual([]);
    expect(s.eyeBombs).toEqual([]);
    expect(s.shieldBank).toBe(SHIELD_START);
    expect(SHIELD_START).toBe(7);
    expect(s.survivors).toBe(MEN_PER_WAVE);
  });

  it('allocId returns unique increasing ids', () => {
    const s = createGameState(1);
    const a = allocId(s);
    const b = allocId(s);
    expect(b).toBe(a + 1);
  });
});
```

Create `tests/render/palette.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PALETTE, explosionColor } from '../../src/render/palette';
import { ENEMY_STATS } from '../../src/game/entities/enemies';
import type { EnemyKind } from '../../src/game/state';

describe('palette', () => {
  it('has a colour for every enemy kind', () => {
    for (const k of Object.keys(ENEMY_STATS) as EnemyKind[]) {
      expect(explosionColor(k)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has landscape colours', () => {
    expect(PALETTE.magma).toMatch(/^#/);
    expect(PALETTE.hotRock).toMatch(/^#/);
    expect(PALETTE.lake).toMatch(/^#/);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/game/entities/enemies.test.ts tests/game/state.test.ts tests/render/palette.test.ts`
Expected: FAIL: the new `describe` blocks fail (`ENEMY_STATS.planter` is undefined, `s.magma` is undefined, palette test fails for `planter`); typecheck also reports the unknown kinds.

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const MAX_BOMBS = 5;
/** Cloak meter drained per second while active (meter is 0..1, so 4 s total). */
export const CLOAK_DRAIN = 0.25;
export const RESPAWN_DELAY = 2;
export const RESPAWN_INVULN = 2;
```

   with:

```ts
export const MAX_BOMBS = 5;
/** Cloak meter drained per second while active (meter is 0..1, so 4 s total). */
export const CLOAK_DRAIN = 0.25;
/** Shield (cloak) seconds at the start of a game. */
export const SHIELD_START = 7;
export const RESPAWN_DELAY = 2;
export const RESPAWN_INVULN = 2;
```

2. Replace:

```ts
/** Enemies only shoot when within this horizontal distance of the player. */
export const ENEMY_FIRE_RANGE = 800;

// Waves
export const MILESTONE_EVERY = 5;
export const WAVE_COMPLETE_TIME = 3;
```

   with:

```ts
/** Enemies only shoot when within this horizontal distance of the player. */
export const ENEMY_FIRE_RANGE = 800;

// Phase 2 enemy roster
export const PLANTER_CRUISE_MIN = 220;
export const PLANTER_CRUISE_MAX = 380;
export const STORM_BAND_TOP = CEILING_Y + 20;
export const STORM_BAND_BOTTOM = CEILING_Y + 80;
export const STORM_ACTION_MIN = 3;
export const STORM_ACTION_MAX = 5;
export const TRAILER_HOMER_CHANCE = 0.5;
export const NMEYE_BOMB_INTERVAL = 0.6;
export const ANTIMATTER_ORBIT_RADIUS = 80;

// Waves
export const MILESTONE_EVERY = 5;
export const WAVE_COMPLETE_TIME = 3;
```

Edit `src/game/state.ts` (7 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import type { GameEvent } from './events';
import { generateTerrain } from './terrain';
import { generateLandscape, applyLandscape, type Landscape } from './landscape';
import { START_LIVES, START_BOMBS, EXTRA_LIFE_EVERY, MEN_PER_WAVE, CEILING_Y } from './constants';

export type Facing = 1 | -1;
```

   with:

```ts
import type { GameEvent } from './events';
import { generateTerrain } from './terrain';
import { generateLandscape, applyLandscape, type Landscape } from './landscape';
import { START_LIVES, START_BOMBS, EXTRA_LIFE_EVERY, MEN_PER_WAVE, CEILING_Y, SHIELD_START } from './constants';

export type Facing = 1 | -1;
```

2. Replace:

```ts
  carryingId: number | null;
}

export type ManState = 'walking' | 'carried' | 'snatched' | 'falling' | 'saved' | 'dead';

export interface Man {
  id: number;
```

   with:

```ts
  carryingId: number | null;
}

export type ManState = 'walking' | 'carried' | 'snatched' | 'chased' | 'falling' | 'saved' | 'dead';

export interface Man {
  id: number;
```

3. Replace:

```ts
  dir: Facing;
  state: ManState;
  fallStartY: number;
  /** Enemy id while snatched. */
  holderId: number | null;
  walkTimer: number;
}

export type EnemyKind = 'snatcher' | 'nemesite' | 'trailer' | 'orb' | 'fragment' | 'hunter';

export interface Enemy {
  id: number;
```

   with:

```ts
  dir: Facing;
  state: ManState;
  fallStartY: number;
  /** Enemy id while snatched (holder) or chased (the Android chasing him). */
  holderId: number | null;
  walkTimer: number;
}

export type EnemyKind =
  | 'snatcher' | 'orb' | 'fragment' | 'hunter'
  | 'planter' | 'android' | 'nemesite' | 'spore' | 'trailer' | 'blunderstorm' | 'nmeye' | 'antimatter';

export interface Enemy {
  id: number;
```

4. Replace:

```ts
  carryingId: number | null;
  aggressive: boolean;
  trailTimer: number;
  dead: boolean;
}
```

   with:

```ts
  carryingId: number | null;
  aggressive: boolean;
  trailTimer: number;
  /** Planter: id of the Android it is lowering. Android: id of the Planter lowering it. */
  linkedId: number | null;
  /** Planter: current tether length in px while lowering. */
  tetherLen: number;
  /** Nemesite: seconds left in the current dodge jink. */
  dodgeTimer: number;
  /** Nemesite: vertical direction of the current jink. */
  dodgeDir: Facing;
  /** Nemesite: the proximity warning has fired. */
  warned: boolean;
  /** Trailer: homes toward the player instead of weaving. */
  homer: boolean;
  /** Android: released from its Planter in mid-air and falling. */
  falling: boolean;
  /** Antimatter: angle around the orbit centre. */
  orbitAngle: number;
  /** Antimatter: orbit centre. */
  orbitX: number;
  orbitY: number;
  /** Blunderstorm: seconds to the next storm action. Nmeye: seconds to the next heading change. */
  actionTimer: number;
  /** Nmeye: seconds to the next bomb. */
  bombTimer: number;
  /** Blunderstorm: seconds until the pending proton bolt (0 = none pending). */
  boltTimer: number;
  dead: boolean;
}
```

5. Replace:

```ts
  x: number;
  y: number;
  life: number;
}

export type GamePhase = 'playing' | 'waveComplete' | 'gameOver';
```

   with:

```ts
  x: number;
  y: number;
  life: number;
}

/** Volcano magma ball or white-hot rock. */
export interface Magma {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hot: boolean;
}

/** Blunderstorm acid drop. */
export interface Acid {
  x: number;
  y: number;
  vy: number;
}

/** Blunderstorm proton bolt: a vertical lethal column. */
export interface Bolt {
  x: number;
  top: number;
  bottom: number;
  life: number;
}

/** Bomb dropped by an Nmeye. */
export interface EyeBomb {
  x: number;
  y: number;
  vy: number;
}

export type GamePhase = 'playing' | 'waveComplete' | 'gameOver';
```

6. Replace:

```ts
  lasers: Laser[];
  shots: Shot[];
  trails: TrailSeg[];
  events: GameEvent[];
  nextId: number;
}
```

   with:

```ts
  lasers: Laser[];
  shots: Shot[];
  trails: TrailSeg[];
  magma: Magma[];
  acid: Acid[];
  bolts: Bolt[];
  eyeBombs: EyeBomb[];
  /** Seconds of shield (cloak) left. */
  shieldBank: number;
  /** Men to deploy at the start of the next wave. */
  survivors: number;
  events: GameEvent[];
  nextId: number;
}
```

7. Replace:

```ts
    lasers: [],
    shots: [],
    trails: [],
    events: [],
    nextId: 1,
  };
```

   with:

```ts
    lasers: [],
    shots: [],
    trails: [],
    magma: [],
    acid: [],
    bolts: [],
    eyeBombs: [],
    shieldBank: SHIELD_START,
    survivors: MEN_PER_WAVE,
    events: [],
    nextId: 1,
  };
```

Replace the whole content of `src/game/events.ts` with:

```ts
import type { EnemyKind } from './state';

export type ExplosionSource = EnemyKind | 'player' | 'man';

export type GameEvent =
  | { type: 'laserFired'; x: number; y: number; facing: 1 | -1 }
  | { type: 'enemyShot'; x: number; y: number }
  | { type: 'explosion'; x: number; y: number; source: ExplosionSource; big: boolean }
  | { type: 'scorePopup'; x: number; y: number; points: number; multiplier: number }
  | { type: 'manPickedUp'; x: number; y: number }
  | { type: 'manCaught'; x: number; y: number }
  | { type: 'manRescued'; x: number; y: number }
  | { type: 'manDied'; x: number; y: number }
  | { type: 'manSnatched'; x: number; y: number }
  | { type: 'playerDied'; x: number; y: number }
  | { type: 'playerRespawned'; x: number; y: number }
  | { type: 'bombDetonated'; x: number; y: number }
  | { type: 'cloakOn' }
  | { type: 'cloakOff' }
  | { type: 'waveStarted'; wave: number }
  | { type: 'waveCleared'; wave: number; bonus: number; saved: number }
  | { type: 'planetCritical' }
  | { type: 'hunterSpawned'; x: number; y: number }
  | { type: 'extraLife' }
  | { type: 'manWhistle'; x: number; y: number }
  | { type: 'manSelfRescued'; x: number; y: number }
  | { type: 'nemesiteWarning'; x: number; y: number }
  | { type: 'rumble'; x: number; y: number }
  | { type: 'protonBolt'; x: number; top: number; bottom: number }
  | { type: 'volcanoErupt'; x: number; y: number; whiteHot: boolean }
  | { type: 'planetUnstable' }
  | { type: 'invasionWave'; wave: number }
  | { type: 'nmeyeSpawned'; x: number; y: number }
  | { type: 'laserBlocked'; x: number; y: number }
  | { type: 'gameOver'; score: number };

export function emit(target: { events: GameEvent[] }, e: GameEvent): void {
  target.events.push(e);
}
```

Replace the whole content of `src/game/entities/enemies.ts` with:

```ts
import { wrapX } from '../../core/world';
import { range, chance } from '../../core/rng';
import { allocId, type GameState, type Enemy, type EnemyKind } from '../state';
import {
  PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX, STORM_BAND_TOP, STORM_BAND_BOTTOM, STORM_ACTION_MIN, STORM_ACTION_MAX,
  TRAILER_HOMER_CHANCE, NMEYE_BOMB_INTERVAL, ANTIMATTER_ORBIT_RADIUS,
} from '../constants';

export interface EnemyStats {
  radius: number;
  points: number;
  speed: number;
  /** Multiplier on the wave's enemy fire interval; 0 = never fires. */
  fireMult: number;
}

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  snatcher: { radius: 14, points: 150, speed: 130, fireMult: 2 },
  orb: { radius: 16, points: 100, speed: 60, fireMult: 0 },
  fragment: { radius: 7, points: 50, speed: 280, fireMult: 0 },
  hunter: { radius: 15, points: 500, speed: 400, fireMult: 0.5 },
  planter: { radius: 15, points: 250, speed: 90, fireMult: 2 },
  android: { radius: 9, points: 50, speed: 29, fireMult: 0 },
  nemesite: { radius: 13, points: 150, speed: 260, fireMult: 0.6 },
  spore: { radius: 14, points: 750, speed: 50, fireMult: 0 },
  trailer: { radius: 14, points: 250, speed: 200, fireMult: 1.5 },
  blunderstorm: { radius: 24, points: 250, speed: 40, fireMult: 0 },
  nmeye: { radius: 14, points: 100, speed: 760, fireMult: 0 },
  antimatter: { radius: 12, points: 150, speed: 160, fireMult: 0 },
};

export const AGGRESSIVE_SPEED_MULT = 1.3;
export const AGGRESSIVE_FIRE_MULT = 0.7;

export function fireInterval(s: GameState, e: Enemy): number {
  const m = ENEMY_STATS[e.kind].fireMult;
  if (m === 0) return Infinity;
  return s.enemyFireInterval * m * (e.aggressive ? AGGRESSIVE_FIRE_MULT : 1);
}

export function resetFireTimer(s: GameState, e: Enemy): void {
  const i = fireInterval(s, e);
  e.fireTimer = i === Infinity ? Infinity : i * range(s.rng, 0.7, 1.3);
}

function speedFor(s: GameState, kind: EnemyKind, aggressive: boolean): number {
  return ENEMY_STATS[kind].speed * s.speedScale * (aggressive ? AGGRESSIVE_SPEED_MULT : 1);
}

/** Puts an Antimatter on its orbit so that its current position is angle 0 of the circle. */
export function startOrbit(e: Enemy): void {
  e.orbitAngle = 0;
  e.orbitX = wrapX(e.x - ANTIMATTER_ORBIT_RADIUS);
  e.orbitY = e.y;
}

/** Creates an enemy. The caller is responsible for pushing it into s.enemies. */
export function createEnemy(s: GameState, kind: EnemyKind, x: number, y: number): Enemy {
  const e: Enemy = {
    id: allocId(s),
    kind,
    x: wrapX(x),
    y,
    vx: 0,
    vy: 0,
    radius: ENEMY_STATS[kind].radius,
    speed: speedFor(s, kind, false),
    fireTimer: 0,
    phase: range(s.rng, 0, Math.PI * 2),
    homeY: y,
    targetId: null,
    carryingId: null,
    aggressive: false,
    trailTimer: 0,
    linkedId: null,
    tetherLen: 0,
    dodgeTimer: 0,
    dodgeDir: 1,
    warned: false,
    homer: false,
    falling: false,
    orbitAngle: 0,
    orbitX: 0,
    orbitY: 0,
    actionTimer: 0,
    bombTimer: 0,
    boltTimer: 0,
    dead: false,
  };
  switch (kind) {
    case 'orb':
      e.vx = range(s.rng, -1, 1) * e.speed;
      e.vy = range(s.rng, -0.6, 0.6) * e.speed;
      break;
    case 'trailer':
      e.vx = chance(s.rng, 0.5) ? e.speed : -e.speed;
      e.homer = chance(s.rng, TRAILER_HOMER_CHANCE);
      break;
    case 'planter':
      e.homeY = range(s.rng, PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX);
      e.y = e.homeY;
      e.vx = chance(s.rng, 0.5) ? e.speed : -e.speed;
      break;
    case 'spore': {
      const a = range(s.rng, 0, Math.PI * 2);
      e.vx = Math.cos(a) * e.speed;
      e.vy = Math.sin(a) * e.speed;
      break;
    }
    case 'blunderstorm':
      e.homeY = range(s.rng, STORM_BAND_TOP, STORM_BAND_BOTTOM);
      e.y = e.homeY;
      e.vx = chance(s.rng, 0.5) ? e.speed : -e.speed;
      e.actionTimer = range(s.rng, STORM_ACTION_MIN, STORM_ACTION_MAX);
      break;
    case 'nmeye':
      e.bombTimer = NMEYE_BOMB_INTERVAL;
      break;
    case 'antimatter':
      startOrbit(e);
      break;
    default:
      break;
  }
  resetFireTimer(s, e);
  return e;
}

export function convertEnemy(s: GameState, e: Enemy, kind: EnemyKind): void {
  e.kind = kind;
  e.radius = ENEMY_STATS[kind].radius;
  e.speed = speedFor(s, kind, e.aggressive);
  e.targetId = null;
  e.carryingId = null;
  e.linkedId = null;
  e.tetherLen = 0;
  e.falling = false;
  e.dodgeTimer = 0;
  resetFireTimer(s, e);
}

export function makeAggressive(s: GameState, e: Enemy): void {
  e.aggressive = true;
  convertEnemy(s, e, e.kind === 'hunter' ? 'hunter' : 'nemesite');
}
```

Replace the whole content of `src/render/palette.ts` with:

```ts
import type { ExplosionSource } from '../game/events';

export const PALETTE = {
  player: '#22e6ff',
  man: '#4dff88',
  snatcher: '#ff3df2',
  nemesite: '#ff3b3b',
  trailer: '#ff9a1f',
  orb: '#a46bff',
  fragment: '#c99bff',
  hunter: '#ffe066',
  planter: '#ff4fd8',
  android: '#b8ff3a',
  spore: '#c56bff',
  blunderstorm: '#8fb8ff',
  nmeye: '#ff5fa0',
  antimatter: '#f0f0ff',
  base: '#19e3c3',
  laser: '#9ff6ff',
  shot: '#ff6a6a',
  terrain: '#3d7bff',
  terrainCritical: '#ff3b5c',
  magma: '#ff7a1a',
  hotRock: '#fff3c4',
  lake: '#3ff0ff',
  hud: '#9ad8ff',
  text: '#e8f6ff',
  warn: '#ff4d6d',
} as const;

export function explosionColor(source: ExplosionSource): string {
  return PALETTE[source];
}
```

Edit `src/render/sprites.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
      line(c, -20, 0, 20, 0);
      c.stroke();
    }),
  };
}
```

   with:

```ts
      line(c, -20, 0, 20, 0);
      c.stroke();
    }),
    planter: makeSprite(16, PALETTE.planter, (c) => {
      c.beginPath();
      c.moveTo(-15, 2);
      c.ellipse(0, 2, 15, 5, 0, 0, Math.PI * 2); // saucer rim
      c.moveTo(-7, -2);
      c.arc(0, -2, 7, Math.PI, 0); // dome
      line(c, 0, 7, 0, 12); // tether hook
      c.stroke();
    }),
    android: makeSprite(10, PALETTE.android, (c) => {
      c.beginPath();
      poly(c, [[-3, -9], [3, -9], [3, -4], [-3, -4]]); // head
      poly(c, [[-5, -3], [5, -3], [4, 4], [-4, 4]]); // body
      line(c, -3, 4, -5, 9);
      line(c, 3, 4, 5, 9);
      line(c, -5, -2, -8, 2);
      line(c, 5, -2, 8, 2);
      c.stroke();
    }),
    spore: makeSprite(15, PALETTE.spore, (c) => {
      c.beginPath();
      circle(c, 0, 0, 9);
      circle(c, 0, 0, 3);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        line(c, Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a) * 14, Math.sin(a) * 14);
      }
      c.stroke();
    }),
    blunderstorm: makeSprite(26, PALETTE.blunderstorm, (c) => {
      c.beginPath();
      c.moveTo(-22, 8);
      c.arc(-12, 2, 10, Math.PI * 0.75, Math.PI * 1.6);
      c.arc(2, -6, 13, Math.PI * 1.1, Math.PI * 1.9);
      c.arc(15, 2, 9, Math.PI * 1.4, Math.PI * 0.4);
      c.lineTo(-22, 8);
      line(c, -6, 12, -10, 20);
      line(c, 6, 12, 2, 20);
      c.stroke();
    }),
    nmeye: makeSprite(15, PALETTE.nmeye, (c) => {
      c.beginPath();
      c.moveTo(-14, 0);
      c.quadraticCurveTo(0, -13, 14, 0);
      c.quadraticCurveTo(0, 13, -14, 0);
      circle(c, 0, 0, 5);
      circle(c, 0, 0, 1.5);
      c.stroke();
    }),
    antimatter: makeSprite(13, PALETTE.antimatter, (c) => {
      c.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        circle(c, Math.cos(a) * 5, Math.sin(a) * 5, 6);
      }
      c.stroke();
    }),
  };
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 237 tests pass, no type errors.

- [ ] **Step 5: Smoke check**

Run `npm run dev`, press Enter and play for 30 s: the game runs with no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A src/game/constants.ts src/game/entities/enemies.ts src/game/events.ts src/game/state.ts src/render/palette.ts src/render/sprites.ts tests/game/entities/enemies.test.ts tests/game/state.test.ts tests/render/palette.test.ts
git commit -m "feat: add the original enemy roster to state, stats, events, palette and sprites"
```

---

### Task 3: Hazards system: magma, acid, proton bolts, Nmeye bombs

One system moves and expires every hazard and kills the player on contact (respecting invulnerability and the cloak). Magma falls under gravity 300 and despawns when it lands while falling; acid and Nmeye bombs fall straight and despawn on the ground; bolts expire after their lifetime. Magma, acid and bombs are used up by the hit; bolts are not. Men are immune to all hazards. `startWave` clears every hazard. Hazards are drawn by the renderer.

**Files:**
- Modify: `src/game/constants.ts`
- Create: `src/game/systems/hazards.ts`
- Modify: `src/game/systems/waves.ts`
- Modify: `src/game/update.ts`
- Modify: `src/render/palette.ts`
- Modify: `src/render/renderer.ts`
- Test (create): `tests/game/systems/hazards.test.ts`
- Test (modify): `tests/game/systems/waves.test.ts`
- Test (modify): `tests/game/update.test.ts`

**Interfaces:**
- Consumes: `killPlayer(s)` (`combat.ts`), `circlesOverlap` (`collision.ts`), `groundYAt`, `Magma`/`Acid`/`Bolt`/`EyeBomb` and the hazard lists from Task 2.
- Produces:
  - `src/game/systems/hazards.ts`:
    - `updateHazards(s: GameState, dt: number): void`
    - `resolveHazardHits(s: GameState): void`
    - `clearHazards(s: GameState): void`
    - `clearHazardsNear(s: GameState, cx: number, range: number): void` (magma, acid, eye bombs only; used by the smart bomb in Task 12)
  - Constants `MAGMA_GRAVITY = 300`, `ACID_SPEED = 220`, `ACID_RADIUS = 4`, `BOLT_WIDTH = 12`, `BOLT_LIFE = 0.25`, `EYE_BOMB_SPEED = 180`, `EYE_BOMB_RADIUS = 5`
  - `update.ts` calls `updateHazards` after the enemy shots and `resolveHazardHits` after `resolvePlayerHits`
  - `PALETTE.acid`, `PALETTE.bolt`; `CanvasRenderer.drawHazards`

- [ ] **Step 1: Write the failing tests**

Create `tests/game/systems/hazards.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import {
  updateHazards, resolveHazardHits, clearHazards, clearHazardsNear,
} from '../../../src/game/systems/hazards';
import { groundYAt } from '../../../src/game/terrain';
import { MAGMA_GRAVITY, ACID_SPEED, BOLT_LIFE, EYE_BOMB_SPEED, START_LIVES } from '../../../src/game/constants';
import { addMan } from '../helpers';

describe('updateHazards', () => {
  it('magma flies under gravity and despawns when it lands', () => {
    const s = createGameState(1);
    const ground = groundYAt(s.terrain, 3000);
    s.magma.push({ x: 3000, y: ground - 10, vx: 100, vy: -300, r: 5, hot: false });
    updateHazards(s, 0.1);
    expect(s.magma[0].vy).toBeCloseTo(-300 + MAGMA_GRAVITY * 0.1);
    expect(s.magma[0].x).toBeCloseTo(3010);
    expect(s.magma[0].y).toBeLessThan(ground - 10);
    for (let i = 0; i < 300 && s.magma.length > 0; i++) updateHazards(s, 0.01);
    expect(s.magma).toHaveLength(0);
  });

  it('rising magma below ground level is not removed', () => {
    const s = createGameState(1);
    const ground = groundYAt(s.terrain, 3000);
    s.magma.push({ x: 3000, y: ground + 2, vx: 0, vy: -300, r: 5, hot: false });
    updateHazards(s, 0.001);
    expect(s.magma).toHaveLength(1);
  });

  it('acid and nmeye bombs fall straight down and despawn on the ground', () => {
    const s = createGameState(1);
    s.acid.push({ x: 3000, y: 200, vy: ACID_SPEED });
    s.eyeBombs.push({ x: 3100, y: 200, vy: EYE_BOMB_SPEED });
    updateHazards(s, 0.5);
    expect(s.acid[0].y).toBeCloseTo(200 + ACID_SPEED * 0.5);
    expect(s.eyeBombs[0].y).toBeCloseTo(200 + EYE_BOMB_SPEED * 0.5);
    updateHazards(s, 5);
    expect(s.acid).toHaveLength(0);
    expect(s.eyeBombs).toHaveLength(0);
  });

  it('bolts expire after their lifetime', () => {
    const s = createGameState(1);
    s.bolts.push({ x: 3000, top: 150, bottom: 600, life: BOLT_LIFE });
    updateHazards(s, BOLT_LIFE - 0.05);
    expect(s.bolts).toHaveLength(1);
    updateHazards(s, 0.1);
    expect(s.bolts).toHaveLength(0);
  });
});

describe('resolveHazardHits', () => {
  it('magma kills the player and is used up', () => {
    const s = createGameState(1);
    s.magma.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, r: 5, hot: false });
    resolveHazardHits(s);
    expect(s.player.alive).toBe(false);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.magma).toHaveLength(0);
  });

  it('acid kills the player', () => {
    const s = createGameState(1);
    s.acid.push({ x: s.player.x + 5, y: s.player.y, vy: ACID_SPEED });
    resolveHazardHits(s);
    expect(s.player.alive).toBe(false);
  });

  it('an nmeye bomb kills the player', () => {
    const s = createGameState(1);
    s.eyeBombs.push({ x: s.player.x, y: s.player.y - 8, vy: EYE_BOMB_SPEED });
    resolveHazardHits(s);
    expect(s.player.alive).toBe(false);
  });

  it('a bolt kills the player inside its column but not beside it', () => {
    const s = createGameState(1);
    s.bolts.push({ x: s.player.x + 40, top: 100, bottom: 650, life: 0.2 });
    resolveHazardHits(s);
    expect(s.player.alive).toBe(true);
    s.bolts[0].x = s.player.x + 10;
    resolveHazardHits(s);
    expect(s.player.alive).toBe(false);
  });

  it('cloak and invulnerability protect the player', () => {
    const s = createGameState(1);
    s.magma.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, r: 5, hot: false });
    s.player.cloakActive = true;
    resolveHazardHits(s);
    expect(s.player.alive).toBe(true);
    s.player.cloakActive = false;
    s.player.invuln = 1;
    resolveHazardHits(s);
    expect(s.player.alive).toBe(true);
    expect(s.magma).toHaveLength(1);
  });

  it('hazards are harmless to men', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000);
    s.magma.push({ x: m.x, y: m.y, vx: 0, vy: 0, r: 5, hot: false });
    s.acid.push({ x: m.x, y: m.y, vy: ACID_SPEED });
    resolveHazardHits(s);
    expect(m.state).toBe('walking');
  });
});

describe('clearing hazards', () => {
  it('clearHazards empties every list', () => {
    const s = createGameState(1);
    s.magma.push({ x: 0, y: 0, vx: 0, vy: 0, r: 5, hot: false });
    s.acid.push({ x: 0, y: 0, vy: 1 });
    s.bolts.push({ x: 0, top: 0, bottom: 1, life: 1 });
    s.eyeBombs.push({ x: 0, y: 0, vy: 1 });
    clearHazards(s);
    expect(s.magma.length + s.acid.length + s.bolts.length + s.eyeBombs.length).toBe(0);
  });

  it('clearHazardsNear only clears magma, acid and bombs within range', () => {
    const s = createGameState(1);
    s.magma.push({ x: 1000, y: 0, vx: 0, vy: 0, r: 5, hot: false }, { x: 4000, y: 0, vx: 0, vy: 0, r: 5, hot: false });
    s.acid.push({ x: 1100, y: 0, vy: 1 });
    s.eyeBombs.push({ x: 900, y: 0, vy: 1 });
    s.bolts.push({ x: 1000, top: 0, bottom: 1, life: 1 });
    clearHazardsNear(s, 1000, 640);
    expect(s.magma).toHaveLength(1);
    expect(s.magma[0].x).toBe(4000);
    expect(s.acid).toHaveLength(0);
    expect(s.eyeBombs).toHaveLength(0);
    expect(s.bolts).toHaveLength(1);
  });
});
```

Edit `tests/game/systems/waves.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Append at the end of the file:

```ts

describe('hazards on wave start', () => {
  it('startWave clears magma, acid, bolts and nmeye bombs', () => {
    const s = createGameState(1);
    s.magma.push({ x: 0, y: 0, vx: 0, vy: 0, r: 5, hot: false });
    s.acid.push({ x: 0, y: 0, vy: 1 });
    s.bolts.push({ x: 0, top: 0, bottom: 1, life: 1 });
    s.eyeBombs.push({ x: 0, y: 0, vy: 1 });
    startWave(s, 2);
    expect(s.magma.length + s.acid.length + s.bolts.length + s.eyeBombs.length).toBe(0);
  });
});
```

Edit `tests/game/update.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Append at the end of the file:

```ts

describe('update hazards', () => {
  it('moves hazards and lets them kill the player', () => {
    const s = createGameState(1);
    addEnemy(s, 'orb', 6000, 300);
    s.acid.push({ x: s.player.x, y: s.player.y - 30, vy: 220 });
    for (let i = 0; i < 30 && s.player.alive; i++) update(s, NO_ACTIONS, SIM_DT);
    expect(s.player.alive).toBe(false);
    expect(s.acid).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/game/systems/hazards.test.ts tests/game/systems/waves.test.ts tests/game/update.test.ts`
Expected: FAIL: `hazards.test.ts` cannot resolve `src/game/systems/hazards`; the new `waves.test.ts` and `update.test.ts` blocks fail (hazards not cleared / never move).

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const NMEYE_BOMB_INTERVAL = 0.6;
export const ANTIMATTER_ORBIT_RADIUS = 80;

// Waves
export const MILESTONE_EVERY = 5;
export const WAVE_COMPLETE_TIME = 3;
```

   with:

```ts
export const NMEYE_BOMB_INTERVAL = 0.6;
export const ANTIMATTER_ORBIT_RADIUS = 80;

// Hazards
export const MAGMA_GRAVITY = 300;
export const ACID_SPEED = 220;
export const ACID_RADIUS = 4;
export const BOLT_WIDTH = 12;
export const BOLT_LIFE = 0.25;
export const EYE_BOMB_SPEED = 180;
export const EYE_BOMB_RADIUS = 5;

// Waves
export const MILESTONE_EVERY = 5;
export const WAVE_COMPLETE_TIME = 3;
```

Create `src/game/systems/hazards.ts`:

```ts
import { wrapX, shortestDx } from '../../core/world';
import type { GameState } from '../state';
import { groundYAt } from '../terrain';
import { circlesOverlap } from './collision';
import { killPlayer } from './combat';
import {
  MAGMA_GRAVITY, ACID_RADIUS, BOLT_WIDTH, EYE_BOMB_RADIUS, PLAYER_RADIUS,
} from '../constants';

/** Moves magma, acid and Nmeye bombs, ages bolts, and drops anything that hit the ground or expired. */
export function updateHazards(s: GameState, dt: number): void {
  for (const m of s.magma) {
    m.vy += MAGMA_GRAVITY * dt;
    m.x = wrapX(m.x + m.vx * dt);
    m.y += m.vy * dt;
  }
  s.magma = s.magma.filter((m) => !(m.vy > 0 && m.y >= groundYAt(s.terrain, m.x)));

  for (const a of s.acid) a.y += a.vy * dt;
  s.acid = s.acid.filter((a) => a.y < groundYAt(s.terrain, a.x));

  for (const b of s.eyeBombs) b.y += b.vy * dt;
  s.eyeBombs = s.eyeBombs.filter((b) => b.y < groundYAt(s.terrain, b.x));

  for (const b of s.bolts) b.life -= dt;
  s.bolts = s.bolts.filter((b) => b.life > 0);
}

/** Kills the player if a hazard touches them. Magma, acid and bombs are used up by the hit; bolts are not. Men are immune. */
export function resolveHazardHits(s: GameState): void {
  const p = s.player;
  if (!p.alive || p.invuln > 0 || p.cloakActive) return;
  const r = PLAYER_RADIUS * 0.8;

  const magma = s.magma.findIndex((m) => circlesOverlap(p.x, p.y, r, m.x, m.y, m.r));
  if (magma >= 0) {
    s.magma.splice(magma, 1);
    killPlayer(s);
    return;
  }
  const acid = s.acid.findIndex((a) => circlesOverlap(p.x, p.y, r, a.x, a.y, ACID_RADIUS));
  if (acid >= 0) {
    s.acid.splice(acid, 1);
    killPlayer(s);
    return;
  }
  const bomb = s.eyeBombs.findIndex((b) => circlesOverlap(p.x, p.y, r, b.x, b.y, EYE_BOMB_RADIUS));
  if (bomb >= 0) {
    s.eyeBombs.splice(bomb, 1);
    killPlayer(s);
    return;
  }
  for (const b of s.bolts) {
    if (Math.abs(shortestDx(b.x, p.x)) <= BOLT_WIDTH / 2 + r && p.y + r >= b.top && p.y - r <= b.bottom) {
      killPlayer(s);
      return;
    }
  }
}

/** Removes every hazard (used when a wave starts). */
export function clearHazards(s: GameState): void {
  s.magma = [];
  s.acid = [];
  s.bolts = [];
  s.eyeBombs = [];
}

/** Removes magma, acid and Nmeye bombs within `range` horizontally of `cx` (smart bomb). */
export function clearHazardsNear(s: GameState, cx: number, range: number): void {
  const far = (x: number) => Math.abs(shortestDx(cx, x)) > range;
  s.magma = s.magma.filter((m) => far(m.x));
  s.acid = s.acid.filter((a) => far(a.x));
  s.eyeBombs = s.eyeBombs.filter((b) => far(b.x));
}
```

Edit `src/game/systems/waves.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { getWaveTuning } from '../tuning';
import { createEnemy } from '../entities/enemies';
import { spawnMen } from './rescue';
import { addScore } from './scoring';
import {
  CEILING_Y, HUNTER_DELAY, HUNTER_REPEAT, MILESTONE_EVERY, MEN_PER_WAVE, MAX_BOMBS,
```

   with:

```ts
import { getWaveTuning } from '../tuning';
import { createEnemy } from '../entities/enemies';
import { spawnMen } from './rescue';
import { clearHazards } from './hazards';
import { addScore } from './scoring';
import {
  CEILING_Y, HUNTER_DELAY, HUNTER_REPEAT, MILESTONE_EVERY, MEN_PER_WAVE, MAX_BOMBS,
```

2. Replace:

```ts
  s.enemies = [];
  s.shots = [];
  s.trails = [];
  s.lasers = [];
  s.men = [];
  s.player.carryingId = null;
```

   with:

```ts
  s.enemies = [];
  s.shots = [];
  s.trails = [];
  clearHazards(s);
  s.lasers = [];
  s.men = [];
  s.player.carryingId = null;
```

Edit `src/game/update.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { tickCombo } from './systems/scoring';
import { updateWaveTimers, checkWaveClear, updateWavePhase } from './systems/waves';
import { updateCloak, triggerBomb, updateRespawn } from './systems/powerups';

export function update(s: GameState, a: Actions, dt: number): void {
  if (s.phase === 'gameOver') return;
```

   with:

```ts
import { tickCombo } from './systems/scoring';
import { updateWaveTimers, checkWaveClear, updateWavePhase } from './systems/waves';
import { updateCloak, triggerBomb, updateRespawn } from './systems/powerups';
import { updateHazards, resolveHazardHits } from './systems/hazards';

export function update(s: GameState, a: Actions, dt: number): void {
  if (s.phase === 'gameOver') return;
```

2. Replace:

```ts
  updateEnemies(s, dt);
  updateShots(s, dt);
  updateTrails(s, dt);
  updateMen(s, dt);
  resolveLaserHits(s);
  resolvePlayerHits(s);
  checkCritical(s);
  tickCombo(s, dt);
  updateWaveTimers(s, dt);
```

   with:

```ts
  updateEnemies(s, dt);
  updateShots(s, dt);
  updateTrails(s, dt);
  updateHazards(s, dt);
  updateMen(s, dt);
  resolveLaserHits(s);
  resolvePlayerHits(s);
  resolveHazardHits(s);
  checkCritical(s);
  tickCombo(s, dt);
  updateWaveTimers(s, dt);
```

Replace the whole content of `src/render/palette.ts` with:

```ts
import type { ExplosionSource } from '../game/events';

export const PALETTE = {
  player: '#22e6ff',
  man: '#4dff88',
  snatcher: '#ff3df2',
  nemesite: '#ff3b3b',
  trailer: '#ff9a1f',
  orb: '#a46bff',
  fragment: '#c99bff',
  hunter: '#ffe066',
  planter: '#ff4fd8',
  android: '#b8ff3a',
  spore: '#c56bff',
  blunderstorm: '#8fb8ff',
  nmeye: '#ff5fa0',
  antimatter: '#f0f0ff',
  base: '#19e3c3',
  laser: '#9ff6ff',
  shot: '#ff6a6a',
  terrain: '#3d7bff',
  terrainCritical: '#ff3b5c',
  magma: '#ff7a1a',
  hotRock: '#fff3c4',
  lake: '#3ff0ff',
  acid: '#9dff3a',
  bolt: '#d8f4ff',
  hud: '#9ad8ff',
  text: '#e8f6ff',
  warn: '#ff4d6d',
} as const;

export function explosionColor(source: ExplosionSource): string {
  return PALETTE[source];
}
```

Edit `src/render/renderer.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { VIEW_W, toScreenX, lerpWrapped } from '../core/world';
import type { GameState } from '../game/state';
import { TRAIL_LIFE, TRAIL_RADIUS } from '../game/constants';
import type { View } from './canvas';
import type { Camera } from './camera';
import { Background } from './background';
```

   with:

```ts
import { VIEW_W, toScreenX, lerpWrapped } from '../core/world';
import type { GameState } from '../game/state';
import { TRAIL_LIFE, TRAIL_RADIUS, ACID_RADIUS, BOLT_WIDTH, EYE_BOMB_RADIUS } from '../game/constants';
import type { View } from './canvas';
import type { Camera } from './camera';
import { Background } from './background';
```

2. Replace:

```ts
    this.drawPlayer(ctx, s, cam.x, alpha);
    this.drawLasers(ctx, s, cam.x);
    this.drawShots(ctx, s, cam.x);
    if (fx) fx.drawWorld(ctx, cam.x);
    ctx.restore();
```

   with:

```ts
    this.drawPlayer(ctx, s, cam.x, alpha);
    this.drawLasers(ctx, s, cam.x);
    this.drawShots(ctx, s, cam.x);
    this.drawHazards(ctx, s, cam.x);
    if (fx) fx.drawWorld(ctx, cam.x);
    ctx.restore();
```

3. Replace:

```ts
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
```

   with:

```ts
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private glowDot(ctx: CanvasRenderingContext2D, sx: number, y: number, r: number, color: string): void {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(sx, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sx, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHazards(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const m of s.magma) {
      const sx = toScreenX(m.x, camX);
      if (onScreen(sx, 30)) this.glowDot(ctx, sx, m.y, m.r, m.hot ? PALETTE.hotRock : PALETTE.magma);
    }
    for (const a of s.acid) {
      const sx = toScreenX(a.x, camX);
      if (!onScreen(sx, 20)) continue;
      this.glowDot(ctx, sx, a.y, ACID_RADIUS, PALETTE.acid);
      ctx.fillRect(sx - 1, a.y - ACID_RADIUS * 3, 2, ACID_RADIUS * 2);
    }
    const flash = Math.floor(s.time * 16) % 2 === 0;
    for (const b of s.eyeBombs) {
      const sx = toScreenX(b.x, camX);
      if (onScreen(sx, 20)) this.glowDot(ctx, sx, b.y, EYE_BOMB_RADIUS, flash ? '#ffffff' : PALETTE.nmeye);
    }
    for (const b of s.bolts) {
      const sx = toScreenX(b.x, camX);
      if (!onScreen(sx, 40)) continue;
      ctx.fillStyle = PALETTE.bolt;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(sx - BOLT_WIDTH, b.top, BOLT_WIDTH * 2, b.bottom - b.top);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(sx - BOLT_WIDTH / 2, b.top, BOLT_WIDTH, b.bottom - b.top);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1.5, b.top, 3, b.bottom - b.top);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 251 tests pass, no type errors.

- [ ] **Step 5: Smoke check**

Run `npm run dev`, press Enter and play for 30 s: the game runs with no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A src/game/constants.ts src/game/systems/hazards.ts src/game/systems/waves.ts src/game/update.ts src/render/palette.ts src/render/renderer.ts tests/game/systems/hazards.test.ts tests/game/systems/waves.test.ts tests/game/update.test.ts
git commit -m "feat: add the hazards system (magma, acid, proton bolts, Nmeye bombs)"
```

---

### Task 4: Volcanoes: magma lobbing and white-hot mode

Each volcano counts down its `timer`. Normal mode: 1–2 magma balls (vx ±60–160, vy −380 to −260, radius 5), next eruption in 2.5–4 s. White-hot mode while the planet is unstable: 2–3 rocks (radius 8, vy −480 to −340), next in 1–1.8 s, and a pending long timer is cut to 1.8 s so the switch is immediate. The planet-unstable flag is still called `s.critical` at this point (renamed to `s.unstable` in Task 9). Each eruption emits `volcanoErupt` and sprays particles.

**Files:**
- Modify: `src/game/constants.ts`
- Create: `src/game/systems/volcanoes.ts`
- Modify: `src/game/update.ts`
- Modify: `src/render/effects.ts`
- Test (create): `tests/game/systems/volcanoes.test.ts`
- Test (modify): `tests/game/update.test.ts`
- Test (modify): `tests/render/effects.test.ts`

**Interfaces:**
- Consumes: `Volcano`, `s.landscape` (Task 1); `s.magma`, `Magma` (Task 2); hazard movement (Task 3); `range`, `intRange`, `chance`; `emit`; `groundYAt`.
- Produces:
  - `src/game/systems/volcanoes.ts`: `erupt(s: GameState, v: Volcano): void`, `updateVolcanoes(s: GameState, dt: number): void`
  - Constants `MAGMA_RADIUS = 5`, `MAGMA_INTERVAL_MIN = 2.5`, `MAGMA_INTERVAL_MAX = 4`, `MAGMA_VX_MIN = 60`, `MAGMA_VX_MAX = 160`, `MAGMA_VY_MIN = -380`, `MAGMA_VY_MAX = -260`, `HOT_ROCK_RADIUS = 8`, `HOT_INTERVAL_MIN = 1`, `HOT_INTERVAL_MAX = 1.8`, `HOT_VY_MIN = -480`, `HOT_VY_MAX = -340`
  - `update.ts` calls `updateVolcanoes` just before `updateHazards`
  - `Effects` handles `volcanoErupt` (14 particles, white when `whiteHot`)

- [ ] **Step 1: Write the failing tests**

Create `tests/game/systems/volcanoes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../src/game/state';
import { updateVolcanoes, erupt } from '../../../src/game/systems/volcanoes';
import { groundYAt } from '../../../src/game/terrain';
import {
  MAGMA_RADIUS, MAGMA_INTERVAL_MIN, MAGMA_INTERVAL_MAX, HOT_ROCK_RADIUS, HOT_INTERVAL_MIN, HOT_INTERVAL_MAX,
} from '../../../src/game/constants';

function oneVolcano(s: GameState, timer: number) {
  s.landscape = { volcanoes: [{ x: 3000, timer }], lakeX: 6000, ditches: [8000], craters: [9000] };
  return s.landscape.volcanoes[0];
}

describe('erupt (normal mode)', () => {
  it('lobs 1-2 magma balls with the spec velocities and resets the timer to 2.5-4 s', () => {
    const s = createGameState(1);
    const v = oneVolcano(s, 0);
    for (let i = 0; i < 40; i++) {
      s.magma = [];
      erupt(s, v);
      expect(s.magma.length).toBeGreaterThanOrEqual(1);
      expect(s.magma.length).toBeLessThanOrEqual(2);
      for (const m of s.magma) {
        expect(Math.abs(m.vx)).toBeGreaterThanOrEqual(60);
        expect(Math.abs(m.vx)).toBeLessThanOrEqual(160);
        expect(m.vy).toBeGreaterThanOrEqual(-380);
        expect(m.vy).toBeLessThanOrEqual(-260);
        expect(m.r).toBe(MAGMA_RADIUS);
        expect(m.hot).toBe(false);
        expect(m.x).toBe(3000);
        expect(m.y).toBeCloseTo(groundYAt(s.terrain, 3000) - 6);
      }
      expect(v.timer).toBeGreaterThanOrEqual(MAGMA_INTERVAL_MIN);
      expect(v.timer).toBeLessThanOrEqual(MAGMA_INTERVAL_MAX);
    }
    expect(s.events.some((e) => e.type === 'volcanoErupt' && !e.whiteHot)).toBe(true);
  });
});

describe('erupt (white-hot mode)', () => {
  it('throws 2-3 bigger, faster rocks every 1-1.8 s when the planet is unstable', () => {
    const s = createGameState(1);
    s.critical = true;
    const v = oneVolcano(s, 0);
    for (let i = 0; i < 40; i++) {
      s.magma = [];
      erupt(s, v);
      expect(s.magma.length).toBeGreaterThanOrEqual(2);
      expect(s.magma.length).toBeLessThanOrEqual(3);
      for (const m of s.magma) {
        expect(m.vy).toBeGreaterThanOrEqual(-480);
        expect(m.vy).toBeLessThanOrEqual(-340);
        expect(m.r).toBe(HOT_ROCK_RADIUS);
        expect(m.hot).toBe(true);
      }
      expect(v.timer).toBeGreaterThanOrEqual(HOT_INTERVAL_MIN);
      expect(v.timer).toBeLessThanOrEqual(HOT_INTERVAL_MAX);
    }
    expect(s.events.some((e) => e.type === 'volcanoErupt' && e.whiteHot)).toBe(true);
  });
});

describe('updateVolcanoes', () => {
  it('erupts when the timer runs out', () => {
    const s = createGameState(1);
    const v = oneVolcano(s, 0.5);
    updateVolcanoes(s, 0.4);
    expect(s.magma).toHaveLength(0);
    updateVolcanoes(s, 0.2);
    expect(s.magma.length).toBeGreaterThan(0);
    expect(v.timer).toBeGreaterThan(2);
  });

  it('a long normal timer is cut to the hot interval once the planet goes unstable', () => {
    const s = createGameState(1);
    oneVolcano(s, 4);
    s.critical = true;
    updateVolcanoes(s, HOT_INTERVAL_MAX + 0.01);
    expect(s.magma.length).toBeGreaterThanOrEqual(2);
  });

  it('every volcano of a real landscape erupts within 4 s', () => {
    const s = createGameState(1);
    let erupted = 0;
    for (let t = 0; t < 4.01; t += 0.01) {
      updateVolcanoes(s, 0.01);
      erupted += s.events.filter((e) => e.type === 'volcanoErupt').length;
      s.events.length = 0;
    }
    expect(erupted).toBeGreaterThanOrEqual(s.landscape.volcanoes.length);
  });
});
```

Edit `tests/game/update.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Append at the end of the file:

```ts

describe('update volcanoes', () => {
  it('volcanoes erupt during play', () => {
    const s = createGameState(1);
    addEnemy(s, 'orb', 6000, 300);
    s.player.invuln = 999;
    for (let t = 0; t < 4.1; t += SIM_DT) update(s, NO_ACTIONS, SIM_DT);
    expect(s.events.some((e) => e.type === 'volcanoErupt')).toBe(true);
  });
});
```

Edit `tests/render/effects.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Append at the end of the file:

```ts

describe('Effects volcano eruptions', () => {
  it('an eruption sprays particles out of the crater', () => {
    const fx = new Effects();
    fx.consume([{ type: 'volcanoErupt', x: 3000, y: 500, whiteHot: false }], s);
    expect(fx.activeParticleCount()).toBeGreaterThanOrEqual(14);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/game/systems/volcanoes.test.ts tests/game/update.test.ts tests/render/effects.test.ts`
Expected: FAIL: `volcanoes.test.ts` cannot resolve `src/game/systems/volcanoes`; the new effects and update blocks fail.

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const NMEYE_BOMB_INTERVAL = 0.6;
export const ANTIMATTER_ORBIT_RADIUS = 80;

// Hazards
export const MAGMA_GRAVITY = 300;
export const ACID_SPEED = 220;
```

   with:

```ts
export const NMEYE_BOMB_INTERVAL = 0.6;
export const ANTIMATTER_ORBIT_RADIUS = 80;

// Volcanoes (normal magma, and white-hot rocks while the planet is unstable)
export const MAGMA_RADIUS = 5;
export const MAGMA_INTERVAL_MIN = 2.5;
export const MAGMA_INTERVAL_MAX = 4;
export const MAGMA_VX_MIN = 60;
export const MAGMA_VX_MAX = 160;
export const MAGMA_VY_MIN = -380;
export const MAGMA_VY_MAX = -260;
export const HOT_ROCK_RADIUS = 8;
export const HOT_INTERVAL_MIN = 1;
export const HOT_INTERVAL_MAX = 1.8;
export const HOT_VY_MIN = -480;
export const HOT_VY_MAX = -340;

// Hazards
export const MAGMA_GRAVITY = 300;
export const ACID_SPEED = 220;
```

Create `src/game/systems/volcanoes.ts`:

```ts
import { range, intRange, chance } from '../../core/rng';
import type { GameState } from '../state';
import type { Volcano } from '../landscape';
import { emit } from '../events';
import { groundYAt } from '../terrain';
import {
  MAGMA_RADIUS, MAGMA_INTERVAL_MIN, MAGMA_INTERVAL_MAX, MAGMA_VX_MIN, MAGMA_VX_MAX, MAGMA_VY_MIN, MAGMA_VY_MAX,
  HOT_ROCK_RADIUS, HOT_INTERVAL_MIN, HOT_INTERVAL_MAX, HOT_VY_MIN, HOT_VY_MAX,
} from '../constants';

/** Volcanoes go white-hot while the planet is unstable. */
function whiteHot(s: GameState): boolean {
  return s.critical;
}

/** Lobs magma (or white-hot rocks) out of a volcano's crater and resets its timer. */
export function erupt(s: GameState, v: Volcano): void {
  const hot = whiteHot(s);
  const count = hot ? intRange(s.rng, 2, 4) : intRange(s.rng, 1, 3);
  const y = groundYAt(s.terrain, v.x) - 6;
  for (let i = 0; i < count; i++) {
    const dir = chance(s.rng, 0.5) ? 1 : -1;
    s.magma.push({
      x: v.x,
      y,
      vx: dir * range(s.rng, MAGMA_VX_MIN, MAGMA_VX_MAX),
      vy: hot ? range(s.rng, HOT_VY_MIN, HOT_VY_MAX) : range(s.rng, MAGMA_VY_MIN, MAGMA_VY_MAX),
      r: hot ? HOT_ROCK_RADIUS : MAGMA_RADIUS,
      hot,
    });
  }
  v.timer = hot ? range(s.rng, HOT_INTERVAL_MIN, HOT_INTERVAL_MAX) : range(s.rng, MAGMA_INTERVAL_MIN, MAGMA_INTERVAL_MAX);
  emit(s, { type: 'volcanoErupt', x: v.x, y, whiteHot: hot });
}

export function updateVolcanoes(s: GameState, dt: number): void {
  const hot = whiteHot(s);
  for (const v of s.landscape.volcanoes) {
    // Switching to white-hot mode takes effect within one hot interval.
    if (hot && v.timer > HOT_INTERVAL_MAX) v.timer = HOT_INTERVAL_MAX;
    v.timer -= dt;
    if (v.timer <= 0) erupt(s, v);
  }
}
```

Edit `src/game/update.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { updateWaveTimers, checkWaveClear, updateWavePhase } from './systems/waves';
import { updateCloak, triggerBomb, updateRespawn } from './systems/powerups';
import { updateHazards, resolveHazardHits } from './systems/hazards';

export function update(s: GameState, a: Actions, dt: number): void {
  if (s.phase === 'gameOver') return;
```

   with:

```ts
import { updateWaveTimers, checkWaveClear, updateWavePhase } from './systems/waves';
import { updateCloak, triggerBomb, updateRespawn } from './systems/powerups';
import { updateHazards, resolveHazardHits } from './systems/hazards';
import { updateVolcanoes } from './systems/volcanoes';

export function update(s: GameState, a: Actions, dt: number): void {
  if (s.phase === 'gameOver') return;
```

2. Replace:

```ts
  updateEnemies(s, dt);
  updateShots(s, dt);
  updateTrails(s, dt);
  updateHazards(s, dt);
  updateMen(s, dt);
  resolveLaserHits(s);
```

   with:

```ts
  updateEnemies(s, dt);
  updateShots(s, dt);
  updateTrails(s, dt);
  updateVolcanoes(s, dt);
  updateHazards(s, dt);
  updateMen(s, dt);
  resolveLaserHits(s);
```

Edit `src/render/effects.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
          this._flash = 0.6;
          this.flashColor = PALETTE.warn;
          break;
        case 'hunterSpawned':
          this.ring(e.x, e.y, 90, PALETTE.hunter, 0.5);
          break;
```

   with:

```ts
          this._flash = 0.6;
          this.flashColor = PALETTE.warn;
          break;
        case 'volcanoErupt': {
          const color = e.whiteHot ? PALETTE.hotRock : PALETTE.magma;
          for (let i = 0; i < 14; i++) {
            this.spawn(e.x, e.y, rand(-90, 90), rand(-260, -120), rand(0.4, 0.8), rand(1.5, 3), color, 1);
          }
          break;
        }
        case 'hunterSpawned':
          this.ring(e.x, e.y, 90, PALETTE.hunter, 0.5);
          break;
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 258 tests pass, no type errors.

- [ ] **Step 5: Browser check**

`npm run dev`: fly to a volcano; every few seconds orange magma balls arc out of the crater with a particle spray and touching one kills you.

- [ ] **Step 6: Commit**

```bash
git add -A src/game/constants.ts src/game/systems/volcanoes.ts src/game/update.ts src/render/effects.ts tests/game/systems/volcanoes.test.ts tests/game/update.test.ts tests/render/effects.test.ts
git commit -m "feat: add erupting volcanoes with a white-hot mode"
```

---

### Task 5: AI split, Planter and Android

First move `src/game/systems/ai.ts` to `src/game/systems/ai/index.ts` (and its test to `tests/game/systems/ai/index.test.ts`); `'./systems/ai'` imports keep working because bundler resolution picks up `index.ts`. Shared helpers go to `ai/common.ts`.

Planter: drifts at its cruise height; over a volcano or the base it rises 120 above it. When a walking (not chased) man is within 40 px horizontally it hovers and lowers an Android on a tether that grows 120 px/s; the man becomes `chased` and whistles. When the Android lands (or dies) the Planter converts to a Nemesite. Android: hangs at the tether end while lowering; on landing chases its man along the surface at 1.6 × walking speed and kills him on contact, then wanders at walking speed. If the Planter is killed while lowering, the Android falls (gravity 300); a falling Android is worth 500 and dies (no points) when it hits the ground. Killing a lowering Android converts its Planter and frees the man. The renderer draws the tether and a blinking "!" above chased men.

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/entities/enemies.ts`
- Create: `src/game/systems/ai/common.ts`
- Move: `src/game/systems/ai.ts` → `src/game/systems/ai/index.ts`
- Create: `src/game/systems/ai/planter.ts`
- Modify: `src/game/systems/combat.ts`
- Modify: `src/game/systems/rescue.ts`
- Modify: `src/render/renderer.ts`
- Test (move): `tests/game/systems/ai.test.ts` → `tests/game/systems/ai/index.test.ts`
- Test (create): `tests/game/systems/ai/planter.test.ts`
- Test (modify): `tests/game/systems/combat.test.ts`
- Test (modify): `tests/game/systems/rescue.test.ts`

**Interfaces:**
- Consumes: `createEnemy`, `convertEnemy`, `ENEMY_STATS` (Task 2), `volcanoAt` (Task 1), `findMan`, `findEnemy`, `circlesOverlap`, `emit`, `groundYAt`, `registerKill`.
- Produces:
  - `src/game/systems/ai/common.ts`: `playerVisible(s: GameState): boolean`, `homeOnPlayer(s: GameState, e: Enemy, dt: number, turnRate: number): void`
  - `src/game/systems/ai/planter.ts`: `updatePlanter(s: GameState, e: Enemy, dt: number): void`, `updateAndroid(s: GameState, e: Enemy, dt: number): void`
  - `src/game/systems/ai/index.ts` (moved): still exports `updateEnemies`, `updateShots`, `updateTrails`; dispatches `planter`/`android`
  - `killPoints(e: Enemy): number` in `enemies.ts` (500 for a falling Android, else `ENEMY_STATS[kind].points`); `killEnemy` uses it
  - Constants `PLANTER_RISE = 120`, `PLANTER_SPOT_RANGE = 40`, `TETHER_SPEED = 120`, `ANDROID_CHASE_MULT = 1.6`, `ANDROID_FALL_GRAVITY = 300`, `ANDROID_FALLING_POINTS = 500`
  - `rescue.ts`: `chased` men walk and can be picked up like walking men and revert to `walking` when their Android is gone

- [ ] **Step 0: Move the AI module and its test**

```bash
mkdir -p src/game/systems/ai tests/game/systems/ai
git mv src/game/systems/ai.ts src/game/systems/ai/index.ts
git mv tests/game/systems/ai.test.ts tests/game/systems/ai/index.test.ts
```

The full post-move content of both files is given in Steps 1 and 3 (import paths gain one `../`).

- [ ] **Step 1: Write the failing tests**

Replace the whole content of `tests/game/systems/ai/index.test.ts` (moved from `tests/game/systems/ai.test.ts` in Step 0) with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../../src/game/state';
import { updateEnemies, updateShots, updateTrails } from '../../../../src/game/systems/ai';
import { SIM_DT, CEILING_Y, SNATCH_CARRY_OFFSET, TRAIL_LIFE, SNATCH_GRACE } from '../../../../src/game/constants';
import { WORLD_W } from '../../../../src/core/world';
import { addMan, addEnemy } from '../../helpers';

function tick(s: ReturnType<typeof createGameState>, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

describe('snatcher', () => {
  it('seeks and grabs a walking man', () => {
    const s = createGameState(1);
    s.waveTime = SNATCH_GRACE;
    const m = addMan(s, 3000);
    const e = addEnemy(s, 'snatcher', 3040, m.y - SNATCH_CARRY_OFFSET - 60);
    e.fireTimer = Infinity;
    tick(s, 3);
    expect(m.state).toBe('snatched');
    expect(m.holderId).toBe(e.id);
    expect(e.carryingId).toBe(m.id);
    expect(s.events.some((ev) => ev.type === 'manSnatched')).toBe(true);
  });

  it('does not target a man during the grace period', () => {
    const s = createGameState(1);
    s.waveTime = 0;
    const m = addMan(s, 3000);
    const e = addEnemy(s, 'snatcher', 3040, m.y - SNATCH_CARRY_OFFSET - 60);
    e.fireTimer = Infinity;
    tick(s, 3);
    expect(m.state).toBe('walking');
    expect(e.targetId).toBeNull();
  });

  it('caps concurrent abductors at 1 + wave', () => {
    const s = createGameState(1);
    s.wave = 1;
    s.waveTime = SNATCH_GRACE;
    const sn = [3000, 4000, 5000].map((x) => {
      const m = addMan(s, x);
      const e = addEnemy(s, 'snatcher', x + 20, m.y - SNATCH_CARRY_OFFSET - 60);
      e.fireTimer = Infinity;
      return e;
    });
    tick(s, 0.5);
    const busy = sn.filter((e) => e.targetId !== null || e.carryingId !== null);
    expect(busy).toHaveLength(2);
  });

  it('kills the man and becomes a nemesite on reaching the top', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'snatched');
    const e = addEnemy(s, 'snatcher', 3000, CEILING_Y + 30);
    e.fireTimer = Infinity;
    m.holderId = e.id;
    e.carryingId = m.id;
    tick(s, 2);
    expect(m.state).toBe('dead');
    expect(e.kind).toBe('nemesite');
    expect(s.events.some((ev) => ev.type === 'manDied')).toBe(true);
  });

  it('wanders when no men are available', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'snatcher', 3000, 300);
    tick(s, 1);
    expect(e.targetId).toBeNull();
    expect(Number.isFinite(e.x)).toBe(true);
  });
});

describe('homing enemies', () => {
  it('nemesite homes toward the player across the seam', () => {
    const s = createGameState(1);
    s.player.x = 50;
    s.player.y = 300;
    const e = addEnemy(s, 'nemesite', WORLD_W - 200, 300);
    e.fireTimer = Infinity;
    tick(s, 1);
    expect(e.vx).toBeGreaterThan(0);
  });

  it('ignores a cloaked player', () => {
    const s = createGameState(1);
    s.player.cloakActive = true;
    const e = addEnemy(s, 'nemesite', s.player.x + 200, s.player.y);
    e.fireTimer = 0.001;
    tick(s, 0.1);
    expect(s.shots).toHaveLength(0);
  });
});

describe('enemy fire', () => {
  it('fires an aimed shot when the timer elapses and the player is in range', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nemesite', s.player.x + 300, s.player.y);
    e.fireTimer = 0.001;
    updateEnemies(s, SIM_DT);
    expect(s.shots).toHaveLength(1);
    expect(s.shots[0].vx).toBeLessThan(0);
    expect(s.events.some((ev) => ev.type === 'enemyShot')).toBe(true);
    expect(e.fireTimer).toBeGreaterThan(0);
  });

  it('does not fire at a player out of range', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nemesite', s.player.x + 3000, s.player.y);
    e.fireTimer = 0.001;
    updateEnemies(s, SIM_DT);
    expect(s.shots).toHaveLength(0);
  });
});

describe('drifters and trailers', () => {
  it('orb bounces off the ceiling', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'orb', 3000, CEILING_Y + 1);
    e.vy = -200;
    tick(s, 0.1);
    expect(e.vy).toBeGreaterThan(0);
  });

  it('trailer leaves trail segments', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 3000, 300);
    e.fireTimer = Infinity;
    tick(s, 0.5);
    expect(s.trails.length).toBeGreaterThan(3);
  });
});

describe('updateShots / updateTrails', () => {
  it('moves shots and removes expired ones', () => {
    const s = createGameState(1);
    s.shots.push({ x: 1000, y: 300, vx: 100, vy: 0, life: 0.05 });
    updateShots(s, 0.01);
    expect(s.shots[0].x).toBeCloseTo(1001);
    updateShots(s, 0.1);
    expect(s.shots).toHaveLength(0);
  });

  it('removes shots that hit the ground', () => {
    const s = createGameState(1);
    s.shots.push({ x: 1000, y: 700, vx: 0, vy: 100, life: 2 });
    updateShots(s, 0.01);
    expect(s.shots).toHaveLength(0);
  });

  it('decays and removes trail segments', () => {
    const s = createGameState(1);
    s.trails.push({ x: 0, y: 300, life: TRAIL_LIFE });
    updateTrails(s, TRAIL_LIFE + 0.01);
    expect(s.trails).toHaveLength(0);
  });
});
```

Create `tests/game/systems/ai/planter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../../src/game/state';
import { updateEnemies } from '../../../../src/game/systems/ai';
import { groundYAt } from '../../../../src/game/terrain';
import {
  SIM_DT, PLANTER_RISE, TETHER_SPEED, ANDROID_CHASE_MULT, MAN_WALK_SPEED,
} from '../../../../src/game/constants';
import { addMan, addEnemy } from '../../helpers';

function tick(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

/** A landscape with nothing near x = 2500..3500 unless the test adds it. */
function plainLandscape(s: GameState) {
  s.landscape = { volcanoes: [{ x: 8000, timer: 99 }], lakeX: 6000, ditches: [9000], craters: [9500] };
}

function planter(s: GameState, x: number) {
  const e = addEnemy(s, 'planter', x, 300);
  e.fireTimer = Infinity;
  return e;
}

describe('planter cruising', () => {
  it('drifts horizontally at its cruise height', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const e = planter(s, 3000);
    const x0 = e.x;
    tick(s, 1);
    expect(Math.abs(e.y - e.homeY)).toBeLessThan(1);
    expect(Math.abs(e.x - x0)).toBeGreaterThan(50);
  });

  it('rises 120 above its cruise height over a volcano', () => {
    const s = createGameState(1);
    plainLandscape(s);
    s.landscape.volcanoes = [{ x: 3000, timer: 99 }];
    const e = planter(s, 3000);
    e.speed = 0;
    tick(s, 4);
    expect(e.y).toBeCloseTo(e.homeY - PLANTER_RISE, 0);
  });

  it('rises 120 above its cruise height over the base', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const e = planter(s, s.baseX);
    e.speed = 0;
    tick(s, 4);
    expect(e.y).toBeCloseTo(e.homeY - PLANTER_RISE, 0);
  });
});

describe('planter lowering an android', () => {
  it('hovers and lowers an Android onto a walking man within 40 px', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const m = addMan(s, 3000);
    const e = planter(s, 3030);
    updateEnemies(s, SIM_DT);
    const android = s.enemies.find((o) => o.kind === 'android');
    expect(android).toBeDefined();
    expect(e.linkedId).toBe(android!.id);
    expect(android!.linkedId).toBe(e.id);
    expect(android!.targetId).toBe(m.id);
    expect(e.vx).toBe(0);
    expect(m.state).toBe('chased');
    expect(m.holderId).toBe(android!.id);
    expect(s.events).toContainEqual({ type: 'manWhistle', x: m.x, y: m.y });
  });

  it('ignores men further than 40 px away and men already chased', () => {
    const s = createGameState(1);
    plainLandscape(s);
    addMan(s, 3000);
    const chased = addMan(s, 5000, 'chased');
    planter(s, 3100).speed = 0;
    planter(s, 5010).speed = 0;
    updateEnemies(s, SIM_DT);
    expect(s.enemies.some((o) => o.kind === 'android')).toBe(false);
    expect(chased.holderId).toBeNull();
  });

  it('grows the tether at 120 px/s with the Android hanging at its end', () => {
    const s = createGameState(1);
    plainLandscape(s);
    addMan(s, 3000);
    const e = planter(s, 3000);
    updateEnemies(s, SIM_DT);
    const len0 = e.tetherLen;
    tick(s, 0.5);
    const android = s.enemies.find((o) => o.kind === 'android')!;
    expect(e.tetherLen).toBeCloseTo(len0 + TETHER_SPEED * 0.5, 0);
    expect(android.x).toBe(e.x);
    expect(android.y).toBeCloseTo(e.y + e.tetherLen, 0);
  });

  it('converts to a Nemesite once its Android lands', () => {
    const s = createGameState(1);
    plainLandscape(s);
    addMan(s, 3000);
    const e = planter(s, 3000);
    tick(s, 5);
    const android = s.enemies.find((o) => o.kind === 'android')!;
    expect(e.kind).toBe('nemesite');
    expect(e.linkedId).toBeNull();
    expect(android.linkedId).toBeNull();
    expect(android.y).toBeCloseTo(groundYAt(s.terrain, android.x) - android.radius, 0);
  });
});

describe('android on the ground', () => {
  function landedAndroid(s: GameState, x: number, targetX: number) {
    const m = addMan(s, targetX, 'chased');
    m.walkTimer = 999;
    const a = addEnemy(s, 'android', x, groundYAt(s.terrain, x) - 9);
    a.targetId = m.id;
    m.holderId = a.id;
    return { m, a };
  }

  it('chases its man along the surface at 1.6x walking speed', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const { a } = landedAndroid(s, 3000, 3300);
    tick(s, 1);
    expect(a.x - 3000).toBeCloseTo(ANDROID_CHASE_MULT * MAN_WALK_SPEED, 0);
    expect(a.y).toBeCloseTo(groundYAt(s.terrain, a.x) - a.radius, 0);
  });

  it('kills the man on contact and then wanders', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const { m, a } = landedAndroid(s, 3000, 3010);
    updateEnemies(s, SIM_DT);
    expect(m.state).toBe('dead');
    expect(a.targetId).toBeNull();
    expect(s.events.some((e) => e.type === 'manDied')).toBe(true);
    const x = a.x;
    tick(s, 1);
    expect(Math.abs(a.x - x)).toBeCloseTo(MAN_WALK_SPEED, 0);
  });

  it('a falling Android dies when it hits the ground', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const a = addEnemy(s, 'android', 3000, 300);
    a.falling = true;
    tick(s, 3);
    expect(a.dead).toBe(true);
    expect(s.score).toBe(0);
    expect(s.events.some((e) => e.type === 'explosion' && e.source === 'android')).toBe(true);
  });
});
```

Edit `tests/game/systems/combat.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Append at the end of the file:

```ts

describe('planter and android kills', () => {
  function lowering(s: ReturnType<typeof createGameState>) {
    const m = addMan(s, 3000, 'chased');
    const p = addEnemy(s, 'planter', 3000, 300);
    const a = addEnemy(s, 'android', 3000, 360);
    p.linkedId = a.id;
    p.tetherLen = 60;
    a.linkedId = p.id;
    a.targetId = m.id;
    m.holderId = a.id;
    return { m, p, a };
  }

  it('killing a Planter while it lowers drops its Android, which is then worth 500', () => {
    const s = createGameState(1);
    const { p, a } = lowering(s);
    killEnemy(s, p);
    expect(a.falling).toBe(true);
    expect(a.linkedId).toBeNull();
    expect(s.score).toBe(ENEMY_STATS.planter.points);
    killEnemy(s, a);
    expect(s.score).toBe(ENEMY_STATS.planter.points + 500 * 2); // second kill in the combo window is x2
  });

  it('a lowering or walking Android is worth 50', () => {
    const s = createGameState(1);
    const { a } = lowering(s);
    killEnemy(s, a);
    expect(s.score).toBe(50);
  });

  it('killing a lowering Android turns its Planter into a Nemesite and frees the man', () => {
    const s = createGameState(1);
    const { m, p, a } = lowering(s);
    killEnemy(s, a);
    expect(p.kind).toBe('nemesite');
    expect(p.linkedId).toBeNull();
    expect(m.state).toBe('walking');
    expect(m.holderId).toBeNull();
  });
});
```

Edit `tests/game/systems/rescue.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Append at the end of the file:

```ts

describe('chased', () => {
  it('a chased man keeps walking and can be picked up', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'chased');
    const a = addEnemy(s, 'android', 3500, 600);
    a.targetId = m.id;
    m.holderId = a.id;
    tick(s, 0.5);
    expect(m.state).toBe('chased');
    expect(m.x).not.toBe(3000);
    s.player.x = m.x;
    s.player.y = m.y - PLAYER_RADIUS;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('carried');
    expect(m.holderId).toBeNull();
  });

  it('goes back to walking when his Android is gone', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'chased');
    const a = addEnemy(s, 'android', 3500, 600);
    a.targetId = m.id;
    m.holderId = a.id;
    a.dead = true;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('walking');
    expect(m.holderId).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/game/systems/ai/index.test.ts tests/game/systems/ai/planter.test.ts tests/game/systems/combat.test.ts tests/game/systems/rescue.test.ts`
Expected: FAIL: `planter.test.ts` (Planters drift but never lower an Android; `updateEnemies` has no `planter` case), the new `combat.test.ts` block (no Android drop, 50 instead of 500) and the new `rescue.test.ts` block (`chased` men do not move).

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const TRAILER_HOMER_CHANCE = 0.5;
export const NMEYE_BOMB_INTERVAL = 0.6;
export const ANTIMATTER_ORBIT_RADIUS = 80;

// Volcanoes (normal magma, and white-hot rocks while the planet is unstable)
export const MAGMA_RADIUS = 5;
```

   with:

```ts
export const TRAILER_HOMER_CHANCE = 0.5;
export const NMEYE_BOMB_INTERVAL = 0.6;
export const ANTIMATTER_ORBIT_RADIUS = 80;
/** Planters rise this far above their cruise height over a volcano or the base. */
export const PLANTER_RISE = 120;
/** A Planter starts lowering when a walking man is within this horizontal distance. */
export const PLANTER_SPOT_RANGE = 40;
export const TETHER_SPEED = 120;
export const ANDROID_CHASE_MULT = 1.6;
export const ANDROID_FALL_GRAVITY = 300;
export const ANDROID_FALLING_POINTS = 500;

// Volcanoes (normal magma, and white-hot rocks while the planet is unstable)
export const MAGMA_RADIUS = 5;
```

Edit `src/game/entities/enemies.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { allocId, type GameState, type Enemy, type EnemyKind } from '../state';
import {
  PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX, STORM_BAND_TOP, STORM_BAND_BOTTOM, STORM_ACTION_MIN, STORM_ACTION_MAX,
  TRAILER_HOMER_CHANCE, NMEYE_BOMB_INTERVAL, ANTIMATTER_ORBIT_RADIUS,
} from '../constants';

export interface EnemyStats {
```

   with:

```ts
import { allocId, type GameState, type Enemy, type EnemyKind } from '../state';
import {
  PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX, STORM_BAND_TOP, STORM_BAND_BOTTOM, STORM_ACTION_MIN, STORM_ACTION_MAX,
  TRAILER_HOMER_CHANCE, NMEYE_BOMB_INTERVAL, ANTIMATTER_ORBIT_RADIUS, ANDROID_FALLING_POINTS,
} from '../constants';

export interface EnemyStats {
```

2. Replace:

```ts
  nmeye: { radius: 14, points: 100, speed: 760, fireMult: 0 },
  antimatter: { radius: 12, points: 150, speed: 160, fireMult: 0 },
};

export const AGGRESSIVE_SPEED_MULT = 1.3;
export const AGGRESSIVE_FIRE_MULT = 0.7;
```

   with:

```ts
  nmeye: { radius: 14, points: 100, speed: 760, fireMult: 0 },
  antimatter: { radius: 12, points: 150, speed: 160, fireMult: 0 },
};

/** Points for killing this enemy right now (a falling Android is worth more). */
export function killPoints(e: Enemy): number {
  if (e.kind === 'android' && e.falling) return ANDROID_FALLING_POINTS;
  return ENEMY_STATS[e.kind].points;
}

export const AGGRESSIVE_SPEED_MULT = 1.3;
export const AGGRESSIVE_FIRE_MULT = 0.7;
```

Create `src/game/systems/ai/common.ts`:

```ts
import { shortestDx } from '../../../core/world';
import type { GameState, Enemy } from '../../state';

/** Enemies only see the player while alive and uncloaked. */
export function playerVisible(s: GameState): boolean {
  return s.player.alive && !s.player.cloakActive;
}

/** Steers the enemy's velocity toward the player at its speed; drifts when the player is hidden. */
export function homeOnPlayer(s: GameState, e: Enemy, dt: number, turnRate: number): void {
  if (!playerVisible(s)) {
    e.vx *= 0.99;
    e.vy = Math.sin(e.phase) * 40;
    return;
  }
  const dx = shortestDx(e.x, s.player.x);
  const dy = s.player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, dt * turnRate);
  e.vx += ((dx / d) * e.speed - e.vx) * k;
  e.vy += ((dy / d) * e.speed - e.vy) * k;
}
```

Replace the whole content of `src/game/systems/ai/index.ts` (moved from `src/game/systems/ai.ts` in Step 0) with:

```ts
import { wrapX, shortestDx } from '../../../core/world';
import type { GameState, Enemy, Man } from '../../state';
import { emit } from '../../events';
import { groundYAt } from '../../terrain';
import { findMan } from '../../query';
import { convertEnemy, resetFireTimer } from '../../entities/enemies';
import {
  CEILING_Y, SNATCH_CARRY_OFFSET, SNATCH_GRACE, TRAIL_LIFE, TRAIL_INTERVAL,
  ENEMY_SHOT_SPEED, ENEMY_SHOT_LIFE, ENEMY_FIRE_RANGE,
} from '../../constants';
import { playerVisible, homeOnPlayer } from './common';
import { updatePlanter, updateAndroid } from './planter';

const SNATCHER_SEEK_RANGE = 2500;
const GRAB_DISTANCE = 10;
const TRAILER_AMPLITUDE = 80;

/** Grace period over, abductor cap not reached, and at least one man is walking. */
function canPickTarget(s: GameState, e: Enemy): boolean {
  if (s.waveTime < SNATCH_GRACE) return false;
  let walking = false;
  for (const m of s.men) {
    if (m.state === 'walking') {
      walking = true;
      break;
    }
  }
  if (!walking) return false;
  let abductors = 0;
  for (const o of s.enemies) {
    if (o !== e && !o.dead && (o.targetId !== null || o.carryingId !== null)) abductors++;
  }
  return abductors < 1 + s.wave;
}

function pickTarget(s: GameState, e: Enemy): Man | undefined {
  const claimed = new Set<number>();
  for (const o of s.enemies) if (o !== e && !o.dead && o.targetId !== null) claimed.add(o.targetId);
  let best: Man | undefined;
  let bestD = SNATCHER_SEEK_RANGE;
  for (const m of s.men) {
    if (m.state !== 'walking' || claimed.has(m.id)) continue;
    const d = Math.abs(shortestDx(e.x, m.x));
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

function updateSnatcher(s: GameState, e: Enemy): void {
  if (e.carryingId !== null) {
    const man = findMan(s, e.carryingId);
    if (!man || man.state !== 'snatched') {
      e.carryingId = null;
      return;
    }
    if (e.y <= CEILING_Y + 1) {
      man.state = 'dead';
      man.holderId = null;
      emit(s, { type: 'manDied', x: man.x, y: man.y });
      convertEnemy(s, e, 'nemesite');
      return;
    }
    e.vx = 0;
    e.vy = -e.speed * 0.8;
    return;
  }

  let target = e.targetId !== null ? findMan(s, e.targetId) : undefined;
  if (!target || target.state !== 'walking') {
    target = canPickTarget(s, e) ? pickTarget(s, e) : undefined;
    e.targetId = target ? target.id : null;
  }
  if (!target) {
    e.vx = Math.cos(e.phase * 0.7) * e.speed;
    e.vy = (e.homeY - e.y) * 0.5 + Math.sin(e.phase * 1.3) * e.speed * 0.3;
    return;
  }

  const dx = shortestDx(e.x, target.x);
  const dy = target.y - SNATCH_CARRY_OFFSET - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist < GRAB_DISTANCE) {
    target.state = 'snatched';
    target.holderId = e.id;
    e.carryingId = target.id;
    e.targetId = null;
    e.vx = 0;
    e.vy = 0;
    emit(s, { type: 'manSnatched', x: target.x, y: target.y });
    return;
  }
  e.vx = (dx / dist) * e.speed;
  e.vy = (dy / dist) * e.speed;
}

function updateTrailer(s: GameState, e: Enemy, dt: number): void {
  e.vx = Math.sign(e.vx || 1) * e.speed;
  const targetY = e.homeY + Math.sin(e.phase * 2.5) * TRAILER_AMPLITUDE;
  e.vy = (targetY - e.y) * 6;
  e.trailTimer -= dt;
  if (e.trailTimer <= 0) {
    s.trails.push({ x: e.x, y: e.y, life: TRAIL_LIFE });
    e.trailTimer = TRAIL_INTERVAL;
  }
}

function integrate(s: GameState, e: Enemy, dt: number): void {
  e.x = wrapX(e.x + e.vx * dt);
  e.y += e.vy * dt;
  if (e.y < CEILING_Y) {
    e.y = CEILING_Y;
    if (e.vy < 0) e.vy = -e.vy;
  }
  const floor = groundYAt(s.terrain, e.x) - e.radius;
  if (e.y > floor) {
    e.y = floor;
    if (e.vy > 0) e.vy = -e.vy;
  }
}

function fireAtPlayer(s: GameState, e: Enemy): void {
  const p = s.player;
  const dx = shortestDx(e.x, p.x);
  const dy = p.y - e.y;
  const t = Math.hypot(dx, dy) / ENEMY_SHOT_SPEED;
  const ax = dx + p.vx * t * 0.5;
  const ay = dy + p.vy * t * 0.5;
  const d = Math.hypot(ax, ay) || 1;
  s.shots.push({
    x: e.x,
    y: e.y,
    vx: (ax / d) * ENEMY_SHOT_SPEED,
    vy: (ay / d) * ENEMY_SHOT_SPEED,
    life: ENEMY_SHOT_LIFE,
  });
  emit(s, { type: 'enemyShot', x: e.x, y: e.y });
}

function updateEnemyFire(s: GameState, e: Enemy, dt: number): void {
  if (e.fireTimer === Infinity) return;
  e.fireTimer -= dt;
  if (e.fireTimer > 0) return;
  resetFireTimer(s, e);
  if (!playerVisible(s)) return;
  if (Math.abs(shortestDx(e.x, s.player.x)) > ENEMY_FIRE_RANGE) return;
  fireAtPlayer(s, e);
}

export function updateEnemies(s: GameState, dt: number): void {
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.phase += dt;
    switch (e.kind) {
      case 'snatcher':
        updateSnatcher(s, e);
        break;
      case 'nemesite':
        homeOnPlayer(s, e, dt, 2);
        break;
      case 'hunter':
        homeOnPlayer(s, e, dt, 4);
        break;
      case 'trailer':
        updateTrailer(s, e, dt);
        break;
      case 'planter':
        updatePlanter(s, e, dt);
        break;
      case 'android':
        updateAndroid(s, e, dt);
        break;
      case 'orb':
      case 'fragment':
      case 'spore':
      case 'blunderstorm':
      case 'nmeye':
      case 'antimatter':
        break;
    }
    integrate(s, e, dt);
    updateEnemyFire(s, e, dt);
  }
}

export function updateShots(s: GameState, dt: number): void {
  for (const sh of s.shots) {
    sh.x = wrapX(sh.x + sh.vx * dt);
    sh.y += sh.vy * dt;
    sh.life -= dt;
    if (sh.y < CEILING_Y || sh.y > groundYAt(s.terrain, sh.x)) sh.life = 0;
  }
  s.shots = s.shots.filter((sh) => sh.life > 0);
}

export function updateTrails(s: GameState, dt: number): void {
  for (const t of s.trails) t.life -= dt;
  s.trails = s.trails.filter((t) => t.life > 0);
}
```

Create `src/game/systems/ai/planter.ts`:

```ts
import { shortestDx } from '../../../core/world';
import type { GameState, Enemy, Man } from '../../state';
import { emit } from '../../events';
import { groundYAt } from '../../terrain';
import { volcanoAt } from '../../landscape';
import { findMan, findEnemy } from '../../query';
import { createEnemy, convertEnemy } from '../../entities/enemies';
import { circlesOverlap } from '../collision';
import {
  BASE_WIDTH, PLANTER_RISE, PLANTER_SPOT_RANGE, TETHER_SPEED, ANDROID_CHASE_MULT, ANDROID_FALL_GRAVITY,
  MAN_WALK_SPEED, MAN_RADIUS,
} from '../../constants';

/** A walking man (not already chased) close enough below the Planter to drop an Android on. */
function findPlantTarget(s: GameState, e: Enemy): Man | undefined {
  return s.men.find((m) => m.state === 'walking' && Math.abs(shortestDx(e.x, m.x)) <= PLANTER_SPOT_RANGE);
}

function startLowering(s: GameState, e: Enemy, man: Man): void {
  const android = createEnemy(s, 'android', e.x, e.y + e.radius);
  android.linkedId = e.id;
  android.targetId = man.id;
  s.enemies.push(android);
  e.linkedId = android.id;
  e.tetherLen = e.radius;
  e.vx = 0;
  e.vy = 0;
  man.state = 'chased';
  man.holderId = android.id;
  emit(s, { type: 'manWhistle', x: man.x, y: man.y });
}

export function updatePlanter(s: GameState, e: Enemy, dt: number): void {
  if (e.linkedId !== null) {
    const android = findEnemy(s, e.linkedId);
    if (!android || android.linkedId !== e.id) {
      convertEnemy(s, e, 'nemesite');
      return;
    }
    e.vx = 0;
    e.vy = 0;
    e.tetherLen += TETHER_SPEED * dt;
    return;
  }
  const raised = volcanoAt(s.landscape, e.x) !== undefined || Math.abs(shortestDx(e.x, s.baseX)) <= BASE_WIDTH / 2;
  const targetY = e.homeY - (raised ? PLANTER_RISE : 0);
  e.vx = (e.vx < 0 ? -1 : 1) * e.speed;
  e.vy = (targetY - e.y) * 2;
  const man = findPlantTarget(s, e);
  if (man) startLowering(s, e, man);
}

function crash(s: GameState, e: Enemy): void {
  e.dead = true;
  emit(s, { type: 'explosion', x: e.x, y: e.y, source: 'android', big: false });
}

export function updateAndroid(s: GameState, e: Enemy, dt: number): void {
  const floor = groundYAt(s.terrain, e.x) - e.radius;

  if (e.falling) {
    if (e.y >= floor - 0.5) {
      crash(s, e);
      return;
    }
    e.vx = 0;
    e.vy += ANDROID_FALL_GRAVITY * dt;
    return;
  }

  if (e.linkedId !== null) {
    const planter = findEnemy(s, e.linkedId);
    if (!planter) {
      e.linkedId = null;
      e.falling = true;
      e.vy = 0;
      return;
    }
    e.x = planter.x;
    e.y = planter.y + planter.tetherLen;
    e.vx = 0;
    e.vy = 0;
    const landY = groundYAt(s.terrain, e.x) - e.radius;
    if (e.y >= landY) {
      e.y = landY;
      e.linkedId = null;
      convertEnemy(s, planter, 'nemesite');
    }
    return;
  }

  // On the ground: chase the target man, or wander once he is gone.
  e.y = floor;
  e.vy = 0;
  const target = e.targetId !== null ? findMan(s, e.targetId) : undefined;
  if (target && target.state === 'chased' && target.holderId === e.id) {
    const dx = shortestDx(e.x, target.x);
    e.vx = Math.sign(dx) * ANDROID_CHASE_MULT * MAN_WALK_SPEED;
    if (circlesOverlap(e.x, e.y, e.radius, target.x, target.y, MAN_RADIUS)) {
      target.state = 'dead';
      target.holderId = null;
      e.targetId = null;
      emit(s, { type: 'manDied', x: target.x, y: target.y });
      emit(s, { type: 'explosion', x: target.x, y: target.y, source: 'man', big: false });
    }
    return;
  }
  e.targetId = null;
  e.vx = (e.vx < 0 ? -1 : 1) * MAN_WALK_SPEED;
}
```

Edit `src/game/systems/combat.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { range } from '../../core/rng';
import type { GameState, Enemy } from '../state';
import { emit } from '../events';
import { findMan } from '../query';
import { ENEMY_STATS, createEnemy } from '../entities/enemies';
import { laserHitsCircle, circlesOverlap } from './collision';
import { registerKill, resetCombo } from './scoring';
import {
```

   with:

```ts
import { range } from '../../core/rng';
import type { GameState, Enemy } from '../state';
import { emit } from '../events';
import { findMan, findEnemy } from '../query';
import { createEnemy, convertEnemy, killPoints } from '../entities/enemies';
import { laserHitsCircle, circlesOverlap } from './collision';
import { registerKill, resetCombo } from './scoring';
import {
```

2. Replace:

```ts
    e.carryingId = null;
  }

  if (e.kind === 'orb') {
    for (let i = 0; i < ORB_FRAGMENTS; i++) {
      const a = (i / ORB_FRAGMENTS) * Math.PI * 2 + range(s.rng, 0, 0.5);
```

   with:

```ts
    e.carryingId = null;
  }

  if (e.kind === 'planter' && e.linkedId !== null) {
    // Killed while lowering: its Android drops.
    const android = findEnemy(s, e.linkedId);
    if (android && android.linkedId === e.id) {
      android.linkedId = null;
      android.falling = true;
      android.vy = 0;
    }
  }

  if (e.kind === 'android') {
    if (e.linkedId !== null) {
      const planter = findEnemy(s, e.linkedId);
      if (planter && planter.linkedId === e.id) convertEnemy(s, planter, 'nemesite');
    }
    if (e.targetId !== null) {
      const m = findMan(s, e.targetId);
      if (m && m.state === 'chased' && m.holderId === e.id) {
        m.state = 'walking';
        m.holderId = null;
      }
    }
  }

  if (e.kind === 'orb') {
    for (let i = 0; i < ORB_FRAGMENTS; i++) {
      const a = (i / ORB_FRAGMENTS) * Math.PI * 2 + range(s.rng, 0, 0.5);
```

3. Replace:

```ts
    }
  }

  registerKill(s, ENEMY_STATS[e.kind].points, e.x, e.y);
  emit(s, { type: 'explosion', x: e.x, y: e.y, source: e.kind, big: e.kind === 'hunter' || e.kind === 'orb' });
  if (e.kind === 'hunter') s.hitStop = Math.max(s.hitStop, HITSTOP_HUNTER);
}
```

   with:

```ts
    }
  }

  registerKill(s, killPoints(e), e.x, e.y);
  emit(s, { type: 'explosion', x: e.x, y: e.y, source: e.kind, big: e.kind === 'hunter' || e.kind === 'orb' });
  if (e.kind === 'hunter') s.hitStop = Math.max(s.hitStop, HITSTOP_HUNTER);
}
```

Edit `src/game/systems/rescue.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  }
  m.x = wrapX(m.x + m.dir * MAN_WALK_SPEED * dt);
  m.y = groundYAt(s.terrain, m.x) - MAN_RADIUS;
}

function playerCanTake(s: GameState): boolean {
```

   with:

```ts
  }
  m.x = wrapX(m.x + m.dir * MAN_WALK_SPEED * dt);
  m.y = groundYAt(s.terrain, m.x) - MAN_RADIUS;
}

/** True while the Android recorded in holderId still exists and is chasing this man. */
function isChasedBy(s: GameState, m: Man): boolean {
  const a = m.holderId !== null ? findEnemy(s, m.holderId) : undefined;
  return a !== undefined && a.kind === 'android' && a.targetId === m.id;
}

function playerCanTake(s: GameState): boolean {
```

2. Replace:

```ts
  }
}

export function updateMen(s: GameState, dt: number): void {
  const p = s.player;
  for (const m of s.men) {
    switch (m.state) {
      case 'walking':
        walk(s, m, dt);
        if (playerCanTake(s) && circlesOverlap(p.x, p.y, PLAYER_RADIUS, m.x, m.y, MAN_RADIUS)) {
          m.state = 'carried';
          p.carryingId = m.id;
          emit(s, { type: 'manPickedUp', x: m.x, y: m.y });
        }
        break;
      case 'carried':
        updateCarried(s, m);
```

   with:

```ts
  }
}

function updateWalking(s: GameState, m: Man, dt: number): void {
  const p = s.player;
  walk(s, m, dt);
  if (playerCanTake(s) && circlesOverlap(p.x, p.y, PLAYER_RADIUS, m.x, m.y, MAN_RADIUS)) {
    m.state = 'carried';
    m.holderId = null;
    p.carryingId = m.id;
    emit(s, { type: 'manPickedUp', x: m.x, y: m.y });
  }
}

export function updateMen(s: GameState, dt: number): void {
  for (const m of s.men) {
    switch (m.state) {
      case 'chased':
        // A chased man keeps walking (and can be picked up); he calms down once his Android is gone.
        if (!isChasedBy(s, m)) {
          m.state = 'walking';
          m.holderId = null;
        }
        updateWalking(s, m, dt);
        break;
      case 'walking':
        updateWalking(s, m, dt);
        break;
      case 'carried':
        updateCarried(s, m);
```

Edit `src/render/renderer.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
      const sx = toScreenX(m.x, camX);
      if (!onScreen(sx, 40)) continue;
      drawSprite(ctx, this.sprites.man, sx, m.y, m.dir < 0);
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    for (const e of s.enemies) {
      const sx = toScreenX(e.x, camX);
      if (!onScreen(sx, 60)) continue;
```

   with:

```ts
      const sx = toScreenX(m.x, camX);
      if (!onScreen(sx, 40)) continue;
      drawSprite(ctx, this.sprites.man, sx, m.y, m.dir < 0);
      if (m.state === 'chased' && Math.floor(s.time * 6) % 2 === 0) {
        ctx.fillStyle = PALETTE.warn;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', sx, m.y - 16);
        ctx.textAlign = 'left';
      }
    }
  }

  private drawTethers(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    ctx.strokeStyle = PALETTE.planter;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    for (const e of s.enemies) {
      if (e.kind !== 'planter' || e.linkedId === null) continue;
      const sx = toScreenX(e.x, camX);
      if (!onScreen(sx, 60)) continue;
      ctx.beginPath();
      ctx.moveTo(sx, e.y + e.radius * 0.5);
      ctx.lineTo(sx, e.y + e.tetherLen);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    this.drawTethers(ctx, s, camX);
    for (const e of s.enemies) {
      const sx = toScreenX(e.x, camX);
      if (!onScreen(sx, 60)) continue;
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 273 tests pass, no type errors.

- [ ] **Step 5: Browser check**

No Planters spawn until Task 10. Check the game still runs normally (`npm run dev`).

- [ ] **Step 6: Commit**

```bash
git add -A src/game/constants.ts src/game/entities/enemies.ts src/game/systems/ai.ts src/game/systems/ai/common.ts src/game/systems/ai/index.ts src/game/systems/ai/planter.ts src/game/systems/combat.ts src/game/systems/rescue.ts src/render/renderer.ts tests/game/systems/ai.test.ts tests/game/systems/ai/index.test.ts tests/game/systems/ai/planter.test.ts tests/game/systems/combat.test.ts tests/game/systems/rescue.test.ts
git commit -m "feat: split enemy AI into a folder and add the Planter and Android"
```

---

### Task 6: Homers: Nemesite dodge, Nmeye, Antimatter

Nemesite: homing at speed 260, turn rate 2/s. If a live player laser is flying toward it, within 40 px vertically and more than 250 px away, it jinks vertically away from the laser line at 140 px/s for 0.35 s (`dodgeTimer`); within 250 px it commits. It emits `nemesiteWarning` once, the first time it is within 640 px of the living player.

Nmeye: every 0.4–0.9 s picks a new heading = bearing to the player ± up to 1 rad (random heading while the player is hidden) at its speed (760 × wave speed scale, faster than the player's 720); drops an `EyeBomb` (180 px/s) every 0.6 s; never fires shots; flashes white when drawn; killing it is a big explosion with hit-stop. The wave timer (60 s, then every 20 s) now spawns Nmeyes instead of Hunters (`nextHunterAt` → `nextNmeyeAt`, `HUNTER_DELAY/REPEAT` → `NMEYE_DELAY/REPEAT`); Hunter code stays until Task 11.

Antimatter: orbits radius 80 at 3 rad/s around a centre that drifts toward the visible player at 160 px/s (the conversion itself is Task 9).

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/state.ts`
- Create: `src/game/systems/ai/homers.ts`
- Modify: `src/game/systems/ai/index.ts`
- Modify: `src/game/systems/combat.ts`
- Modify: `src/game/systems/waves.ts`
- Modify: `src/audio/eventAudio.ts`
- Modify: `src/render/effects.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/render/sprites.ts`
- Test (modify): `tests/audio/eventAudio.test.ts`
- Test (modify): `tests/game/sim.test.ts`
- Test (create): `tests/game/systems/ai/homers.test.ts`
- Test (modify): `tests/game/systems/combat.test.ts`
- Test (modify): `tests/game/systems/waves.test.ts`

**Interfaces:**
- Consumes: `playerVisible`, `homeOnPlayer` (Task 5), `s.lasers`, `s.eyeBombs` (Task 2), `startOrbit` (Task 2), `range`, `emit`.
- Produces:
  - `src/game/systems/ai/homers.ts`: `updateNemesite(s, e, dt)`, `updateNmeye(s, e, dt)`, `updateAntimatter(s, e, dt)` (all `(s: GameState, e: Enemy, dt: number) => void`)
  - `GameState.nextNmeyeAt` (replaces `nextHunterAt`); constants `NMEYE_DELAY = 60`, `NMEYE_REPEAT = 20` (replace `HUNTER_DELAY`, `HUNTER_REPEAT`)
  - Constants `NEMESITE_TURN_RATE = 2`, `NEMESITE_COMMIT_RANGE = 250`, `NEMESITE_DODGE_BAND = 40`, `NEMESITE_DODGE_SPEED = 140`, `NEMESITE_DODGE_TIME = 0.35`, `NEMESITE_WARN_RANGE = 640`, `NMEYE_TURN_MIN = 0.4`, `NMEYE_TURN_MAX = 0.9`, `NMEYE_WOBBLE = 1`, `ANTIMATTER_DRIFT = 160`, `ANTIMATTER_SPIN = 3`
  - `updateWaveTimers` spawns `'nmeye'` and emits `nmeyeSpawned`; `eventAudio` plays `sfx.hunter()` for it (renamed in Task 13); `Effects` rings it
  - `drawSprite(ctx, sprite, x, y, flipX = false, alpha = 1, angle = 0)` gains an optional rotation used to spin Antimatter

- [ ] **Step 1: Write the failing tests**

Edit `tests/audio/eventAudio.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Append at the end of the file:

```ts

describe('createEventAudio nmeye', () => {
  it('plays the warning sting when an Nmeye appears', () => {
    const { sfx, calls } = fakeSfx();
    createEventAudio(sfx, () => 0)([{ type: 'nmeyeSpawned', x: 0, y: 0 }]);
    expect(calls).toEqual(['hunter']);
  });
});
```

Edit `tests/game/sim.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  };
}

function simulate(seed: number, seconds: number, lives?: number): { s: GameState; hunters: number } {
  const s = newGame(seed);
  if (lives !== undefined) s.lives = lives;
  const ticks = Math.round(seconds / SIM_DT);
  let hunters = 0;
  for (let i = 0; i < ticks; i++) {
    update(s, scriptedActions(i), SIM_DT);
    for (const e of s.events) if (e.type === 'hunterSpawned') hunters++;
    s.events.length = 0;
  }
  return { s, hunters };
}

function allFinite(s: GameState): boolean {
```

   with:

```ts
  };
}

function simulate(seed: number, seconds: number, lives?: number): { s: GameState; nmeyes: number } {
  const s = newGame(seed);
  if (lives !== undefined) s.lives = lives;
  const ticks = Math.round(seconds / SIM_DT);
  let nmeyes = 0;
  for (let i = 0; i < ticks; i++) {
    update(s, scriptedActions(i), SIM_DT);
    for (const e of s.events) if (e.type === 'nmeyeSpawned') nmeyes++;
    s.events.length = 0;
  }
  return { s, nmeyes };
}

function allFinite(s: GameState): boolean {
```

2. Replace:

```ts

describe('deterministic simulation', () => {
  it('runs 90 s of scripted play without NaNs or runaway entity counts', () => {
    const { s, hunters } = simulate(1234, 90, 99);
    expect(s.time).toBeCloseTo(90, 0);
    expect(hunters).toBeGreaterThanOrEqual(1);
    expect(allFinite(s)).toBe(true);
    expect(s.enemies.length).toBeLessThan(200);
    expect(s.shots.length).toBeLessThan(500);
```

   with:

```ts

describe('deterministic simulation', () => {
  it('runs 90 s of scripted play without NaNs or runaway entity counts', () => {
    const { s, nmeyes } = simulate(1234, 90, 99);
    expect(s.time).toBeCloseTo(90, 0);
    expect(nmeyes).toBeGreaterThanOrEqual(1);
    expect(allFinite(s)).toBe(true);
    expect(s.enemies.length).toBeLessThan(200);
    expect(s.shots.length).toBeLessThan(500);
```

Create `tests/game/systems/ai/homers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../../src/game/state';
import { updateEnemies } from '../../../../src/game/systems/ai';
import { shortestDx } from '../../../../src/core/world';
import {
  SIM_DT, NEMESITE_DODGE_SPEED, NEMESITE_DODGE_TIME, NMEYE_BOMB_INTERVAL, EYE_BOMB_SPEED, PLAYER_MAX_VX,
  ANTIMATTER_ORBIT_RADIUS, ANTIMATTER_DRIFT, ANTIMATTER_SPIN,
} from '../../../../src/game/constants';
import { addEnemy } from '../../helpers';

function tick(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

function nemesite(s: GameState, dx: number, dy = 0) {
  const e = addEnemy(s, 'nemesite', s.player.x + dx, s.player.y + dy);
  e.fireTimer = Infinity;
  return e;
}

function laser(s: GameState, x: number, y: number, vx: number) {
  s.lasers.push({ x, prevX: x, y, vx, life: 0.4 });
}

describe('nemesite dodge', () => {
  it('jinks vertically away from a laser heading toward it from more than 250 px', () => {
    const s = createGameState(1);
    const e = nemesite(s, 600);
    laser(s, s.player.x + 20, e.y + 10, 2200);
    const y0 = e.y;
    updateEnemies(s, SIM_DT);
    expect(e.dodgeTimer).toBeCloseTo(NEMESITE_DODGE_TIME);
    expect(e.vy).toBe(-NEMESITE_DODGE_SPEED);
    s.lasers = [];
    tick(s, 0.3);
    expect(e.vy).toBe(-NEMESITE_DODGE_SPEED);
    expect(e.y).toBeLessThan(y0 - 40);
    tick(s, 0.1);
    expect(e.dodgeTimer).toBe(0);
  });

  it('commits (no dodge) once the laser is within 250 px', () => {
    const s = createGameState(1);
    const e = nemesite(s, 600);
    laser(s, e.x - 200, e.y, 2200);
    updateEnemies(s, SIM_DT);
    expect(e.dodgeTimer).toBe(0);
  });

  it('ignores lasers flying away from it or outside the 40 px band', () => {
    const s = createGameState(1);
    const e = nemesite(s, 600);
    laser(s, e.x - 400, e.y, -2200);
    laser(s, e.x - 400, e.y + 60, 2200);
    updateEnemies(s, SIM_DT);
    expect(e.dodgeTimer).toBe(0);
  });

  it('homes toward the player when not dodging', () => {
    const s = createGameState(1);
    const e = nemesite(s, 600);
    tick(s, 1);
    expect(e.vx).toBeLessThan(0);
  });

  it('warns once when it first comes within 640 px of the player', () => {
    const s = createGameState(1);
    nemesite(s, 700);
    updateEnemies(s, SIM_DT);
    expect(s.events.some((ev) => ev.type === 'nemesiteWarning')).toBe(false);
    tick(s, 2);
    expect(s.events.filter((ev) => ev.type === 'nemesiteWarning')).toHaveLength(1);
  });
});

describe('nmeye', () => {
  it('is faster than the player and heads roughly toward them', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nmeye', s.player.x + 1000, s.player.y);
    updateEnemies(s, SIM_DT);
    expect(e.speed).toBeGreaterThan(PLAYER_MAX_VX);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(e.speed);
    expect(e.vx).toBeLessThan(0);
    expect(e.actionTimer).toBeGreaterThanOrEqual(0.4 - SIM_DT);
    expect(e.actionTimer).toBeLessThanOrEqual(0.9);
  });

  it('picks a new heading every 0.4-0.9 s', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nmeye', s.player.x + 3000, 300);
    updateEnemies(s, SIM_DT);
    let changes = 0;
    let last = Math.atan2(e.vy, e.vx);
    for (let t = 0; t < 4; t += SIM_DT) {
      updateEnemies(s, SIM_DT);
      const h = Math.atan2(e.vy, e.vx);
      if (Math.abs(h - last) > 1e-9) changes++;
      last = h;
    }
    expect(changes).toBeGreaterThanOrEqual(4);
    expect(changes).toBeLessThanOrEqual(11);
  });

  it('drops a bomb every 0.6 s', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nmeye', s.player.x + 3000, 300);
    tick(s, NMEYE_BOMB_INTERVAL * 2 + 0.05);
    expect(s.eyeBombs).toHaveLength(2);
    expect(s.eyeBombs[0].vy).toBe(EYE_BOMB_SPEED);
    expect(e.fireTimer).toBe(Infinity);
    expect(s.shots).toHaveLength(0);
  });
});

describe('antimatter', () => {
  it('circles its centre at radius 80 and 3 rad/s', () => {
    const s = createGameState(1);
    s.player.cloakActive = true; // centre stays put
    const e = addEnemy(s, 'antimatter', 3000, 300);
    const cx = e.orbitX;
    tick(s, 0.5);
    expect(Math.hypot(shortestDx(cx, e.x), e.y - 300)).toBeCloseTo(ANTIMATTER_ORBIT_RADIUS, 0);
    expect(e.orbitAngle).toBeCloseTo(ANTIMATTER_SPIN * 0.5, 1);
    expect(e.orbitX).toBe(cx);
  });

  it('its orbit centre drifts toward the player at 160 px/s', () => {
    const s = createGameState(1);
    s.player.y = 300;
    const e = addEnemy(s, 'antimatter', s.player.x + 1500, 300);
    const cx = e.orbitX;
    tick(s, 1);
    expect(shortestDx(e.orbitX, cx)).toBeCloseTo(ANTIMATTER_DRIFT, -1);
  });
});
```

Edit `tests/game/systems/combat.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Append at the end of the file:

```ts

describe('nmeye kills', () => {
  it('killing an Nmeye is a big explosion with hit-stop', () => {
    const s = createGameState(1);
    killEnemy(s, addEnemy(s, 'nmeye', 2000, 300));
    expect(s.score).toBe(ENEMY_STATS.nmeye.points);
    expect(s.hitStop).toBe(HITSTOP_HUNTER);
    expect(s.events).toContainEqual({ type: 'explosion', x: 2000, y: 300, source: 'nmeye', big: true });
  });
});
```

Edit `tests/game/systems/waves.test.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
} from '../../../src/game/systems/waves';
import { getWaveTuning } from '../../../src/game/tuning';
import {
  MEN_PER_WAVE, HUNTER_DELAY, HUNTER_REPEAT, SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME,
  WAVE_BONUS_PER_MAN, START_BOMBS, MAX_BOMBS,
} from '../../../src/game/constants';
import { shortestDx } from '../../../src/core/world';
```

   with:

```ts
} from '../../../src/game/systems/waves';
import { getWaveTuning } from '../../../src/game/tuning';
import {
  MEN_PER_WAVE, NMEYE_DELAY, NMEYE_REPEAT, SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME,
  WAVE_BONUS_PER_MAN, START_BOMBS, MAX_BOMBS,
} from '../../../src/game/constants';
import { shortestDx } from '../../../src/core/world';
```

2. Replace:

```ts
    expect(s.player.cloak).toBe(1);
    expect(s.shots).toHaveLength(0);
    expect(s.waveTime).toBe(0);
    expect(s.nextHunterAt).toBe(HUNTER_DELAY);
  });

  it('spawns no men after the planet went critical', () => {
```

   with:

```ts
    expect(s.player.cloak).toBe(1);
    expect(s.shots).toHaveLength(0);
    expect(s.waveTime).toBe(0);
    expect(s.nextNmeyeAt).toBe(NMEYE_DELAY);
  });

  it('spawns no men after the planet went critical', () => {
```

3. Replace:

```ts
  });
});

describe('hunters', () => {
  it('spawns a hunter after HUNTER_DELAY and then every HUNTER_REPEAT', () => {
    const s = createGameState(1);
    startWave(s, 1);
    const hunters = () => s.enemies.filter((e) => e.kind === 'hunter').length;
    updateWaveTimers(s, HUNTER_DELAY - 0.01);
    expect(hunters()).toBe(0);
    updateWaveTimers(s, 0.02);
    expect(hunters()).toBe(1);
    expect(s.events.some((e) => e.type === 'hunterSpawned')).toBe(true);
    updateWaveTimers(s, HUNTER_REPEAT);
    expect(hunters()).toBe(2);
  });
});
```

   with:

```ts
  });
});

describe('nmeye timer', () => {
  it('spawns an Nmeye 60 s into the wave and then every 20 s', () => {
    const s = createGameState(1);
    startWave(s, 1);
    expect(NMEYE_DELAY).toBe(60);
    expect(NMEYE_REPEAT).toBe(20);
    const nmeyes = () => s.enemies.filter((e) => e.kind === 'nmeye').length;
    updateWaveTimers(s, NMEYE_DELAY - 0.01);
    expect(nmeyes()).toBe(0);
    updateWaveTimers(s, 0.02);
    expect(nmeyes()).toBe(1);
    expect(s.events.some((e) => e.type === 'nmeyeSpawned')).toBe(true);
    updateWaveTimers(s, NMEYE_REPEAT);
    expect(nmeyes()).toBe(2);
    expect(s.enemies.some((e) => e.kind === 'hunter')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/audio/eventAudio.test.ts tests/game/sim.test.ts tests/game/systems/ai/homers.test.ts tests/game/systems/combat.test.ts tests/game/systems/waves.test.ts`
Expected: FAIL: `homers.test.ts` (no dodge, no bombs, no orbit), `waves.test.ts` (`NMEYE_DELAY` undefined / no Nmeye spawned), `sim.test.ts` (no `nmeyeSpawned` events), the new combat and eventAudio blocks.

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const TRAIL_LIFE = 1.5;
export const TRAIL_INTERVAL = 0.05;
export const TRAIL_RADIUS = 6;
export const HUNTER_DELAY = 60;
export const HUNTER_REPEAT = 20;
/** Enemies only shoot when within this horizontal distance of the player. */
export const ENEMY_FIRE_RANGE = 800;
```

   with:

```ts
export const TRAIL_LIFE = 1.5;
export const TRAIL_INTERVAL = 0.05;
export const TRAIL_RADIUS = 6;
/** The first Nmeye appears this many seconds into a wave, then one every NMEYE_REPEAT seconds. */
export const NMEYE_DELAY = 60;
export const NMEYE_REPEAT = 20;
/** Enemies only shoot when within this horizontal distance of the player. */
export const ENEMY_FIRE_RANGE = 800;
```

2. Replace:

```ts
export const ANDROID_CHASE_MULT = 1.6;
export const ANDROID_FALL_GRAVITY = 300;
export const ANDROID_FALLING_POINTS = 500;

// Volcanoes (normal magma, and white-hot rocks while the planet is unstable)
export const MAGMA_RADIUS = 5;
```

   with:

```ts
export const ANDROID_CHASE_MULT = 1.6;
export const ANDROID_FALL_GRAVITY = 300;
export const ANDROID_FALLING_POINTS = 500;
export const NEMESITE_TURN_RATE = 2;
/** A Nemesite only dodges lasers that are further away than this; closer, it commits. */
export const NEMESITE_COMMIT_RANGE = 250;
export const NEMESITE_DODGE_BAND = 40;
export const NEMESITE_DODGE_SPEED = 140;
export const NEMESITE_DODGE_TIME = 0.35;
export const NEMESITE_WARN_RANGE = 640;
export const NMEYE_TURN_MIN = 0.4;
export const NMEYE_TURN_MAX = 0.9;
/** Max random offset (radians) from the bearing to the player when an Nmeye picks a new heading. */
export const NMEYE_WOBBLE = 1;
export const ANTIMATTER_DRIFT = 160;
export const ANTIMATTER_SPIN = 3;

// Volcanoes (normal magma, and white-hot rocks while the planet is unstable)
export const MAGMA_RADIUS = 5;
```

Edit `src/game/state.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  time: number;
  wave: number;
  waveTime: number;
  nextHunterAt: number;
  score: number;
  lives: number;
  bombs: number;
```

   with:

```ts
  time: number;
  wave: number;
  waveTime: number;
  /** waveTime at which the next Nmeye appears. */
  nextNmeyeAt: number;
  score: number;
  lives: number;
  bombs: number;
```

2. Replace:

```ts
    time: 0,
    wave: 0,
    waveTime: 0,
    nextHunterAt: Infinity,
    score: 0,
    lives: START_LIVES,
    bombs: START_BOMBS,
```

   with:

```ts
    time: 0,
    wave: 0,
    waveTime: 0,
    nextNmeyeAt: Infinity,
    score: 0,
    lives: START_LIVES,
    bombs: START_BOMBS,
```

Create `src/game/systems/ai/homers.ts`:

```ts
import { wrapX, shortestDx } from '../../../core/world';
import { range } from '../../../core/rng';
import type { GameState, Enemy, Laser } from '../../state';
import { emit } from '../../events';
import { playerVisible, homeOnPlayer } from './common';
import {
  NEMESITE_TURN_RATE, NEMESITE_COMMIT_RANGE, NEMESITE_DODGE_BAND, NEMESITE_DODGE_SPEED, NEMESITE_DODGE_TIME,
  NEMESITE_WARN_RANGE, NMEYE_TURN_MIN, NMEYE_TURN_MAX, NMEYE_WOBBLE, NMEYE_BOMB_INTERVAL, EYE_BOMB_SPEED,
  ANTIMATTER_ORBIT_RADIUS, ANTIMATTER_DRIFT, ANTIMATTER_SPIN,
} from '../../constants';

/** A player laser flying toward the Nemesite, level with it, and still far enough away to dodge. */
function threateningLaser(s: GameState, e: Enemy): Laser | undefined {
  for (const l of s.lasers) {
    if (l.life <= 0) continue;
    const dx = shortestDx(l.x, e.x);
    if (Math.sign(dx) !== Math.sign(l.vx)) continue;
    if (Math.abs(dx) <= NEMESITE_COMMIT_RANGE) continue;
    if (Math.abs(l.y - e.y) > NEMESITE_DODGE_BAND) continue;
    return l;
  }
  return undefined;
}

export function updateNemesite(s: GameState, e: Enemy, dt: number): void {
  const p = s.player;
  if (!e.warned && p.alive && Math.hypot(shortestDx(e.x, p.x), p.y - e.y) <= NEMESITE_WARN_RANGE) {
    e.warned = true;
    emit(s, { type: 'nemesiteWarning', x: e.x, y: e.y });
  }
  if (e.dodgeTimer > 0) {
    e.dodgeTimer = Math.max(0, e.dodgeTimer - dt);
    e.vy = e.dodgeDir * NEMESITE_DODGE_SPEED;
    return;
  }
  homeOnPlayer(s, e, dt, NEMESITE_TURN_RATE);
  const l = threateningLaser(s, e);
  if (l) {
    e.dodgeDir = e.y < l.y ? -1 : 1;
    e.dodgeTimer = NEMESITE_DODGE_TIME;
    e.vy = e.dodgeDir * NEMESITE_DODGE_SPEED;
  }
}

export function updateNmeye(s: GameState, e: Enemy, dt: number): void {
  e.actionTimer -= dt;
  if (e.actionTimer <= 0) {
    e.actionTimer = range(s.rng, NMEYE_TURN_MIN, NMEYE_TURN_MAX);
    const heading = playerVisible(s)
      ? Math.atan2(s.player.y - e.y, shortestDx(e.x, s.player.x)) + range(s.rng, -NMEYE_WOBBLE, NMEYE_WOBBLE)
      : range(s.rng, 0, Math.PI * 2);
    e.vx = Math.cos(heading) * e.speed;
    e.vy = Math.sin(heading) * e.speed;
  }
  e.bombTimer -= dt;
  if (e.bombTimer <= 0) {
    e.bombTimer += NMEYE_BOMB_INTERVAL;
    s.eyeBombs.push({ x: e.x, y: e.y + e.radius, vy: EYE_BOMB_SPEED });
  }
}

export function updateAntimatter(s: GameState, e: Enemy, dt: number): void {
  if (playerVisible(s)) {
    const dx = shortestDx(e.orbitX, s.player.x);
    const dy = s.player.y - e.orbitY;
    const d = Math.hypot(dx, dy);
    if (d > 0) {
      const step = Math.min(d, ANTIMATTER_DRIFT * dt);
      e.orbitX = wrapX(e.orbitX + (dx / d) * step);
      e.orbitY += (dy / d) * step;
    }
  }
  e.orbitAngle += ANTIMATTER_SPIN * dt;
  const tx = wrapX(e.orbitX + Math.cos(e.orbitAngle) * ANTIMATTER_ORBIT_RADIUS);
  const ty = e.orbitY + Math.sin(e.orbitAngle) * ANTIMATTER_ORBIT_RADIUS;
  // Velocity that lands exactly on the orbit point after integration.
  e.vx = shortestDx(e.x, tx) / dt;
  e.vy = (ty - e.y) / dt;
}
```

Edit `src/game/systems/ai/index.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
} from '../../constants';
import { playerVisible, homeOnPlayer } from './common';
import { updatePlanter, updateAndroid } from './planter';

const SNATCHER_SEEK_RANGE = 2500;
const GRAB_DISTANCE = 10;
```

   with:

```ts
} from '../../constants';
import { playerVisible, homeOnPlayer } from './common';
import { updatePlanter, updateAndroid } from './planter';
import { updateNemesite, updateNmeye, updateAntimatter } from './homers';

const SNATCHER_SEEK_RANGE = 2500;
const GRAB_DISTANCE = 10;
```

2. Replace:

```ts
        updateSnatcher(s, e);
        break;
      case 'nemesite':
        homeOnPlayer(s, e, dt, 2);
        break;
      case 'hunter':
        homeOnPlayer(s, e, dt, 4);
```

   with:

```ts
        updateSnatcher(s, e);
        break;
      case 'nemesite':
        updateNemesite(s, e, dt);
        break;
      case 'nmeye':
        updateNmeye(s, e, dt);
        break;
      case 'antimatter':
        updateAntimatter(s, e, dt);
        break;
      case 'hunter':
        homeOnPlayer(s, e, dt, 4);
```

3. Replace:

```ts
      case 'fragment':
      case 'spore':
      case 'blunderstorm':
      case 'nmeye':
      case 'antimatter':
        break;
    }
    integrate(s, e, dt);
```

   with:

```ts
      case 'fragment':
      case 'spore':
      case 'blunderstorm':
        break;
    }
    integrate(s, e, dt);
```

Edit `src/game/systems/combat.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  }

  registerKill(s, killPoints(e), e.x, e.y);
  emit(s, { type: 'explosion', x: e.x, y: e.y, source: e.kind, big: e.kind === 'hunter' || e.kind === 'orb' });
  if (e.kind === 'hunter') s.hitStop = Math.max(s.hitStop, HITSTOP_HUNTER);
}

export function resolveLaserHits(s: GameState): void {
```

   with:

```ts
  }

  registerKill(s, killPoints(e), e.x, e.y);
  const big = e.kind === 'hunter' || e.kind === 'orb' || e.kind === 'nmeye';
  emit(s, { type: 'explosion', x: e.x, y: e.y, source: e.kind, big });
  if (e.kind === 'hunter' || e.kind === 'nmeye') s.hitStop = Math.max(s.hitStop, HITSTOP_HUNTER);
}

export function resolveLaserHits(s: GameState): void {
```

Edit `src/game/systems/waves.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { clearHazards } from './hazards';
import { addScore } from './scoring';
import {
  CEILING_Y, HUNTER_DELAY, HUNTER_REPEAT, MILESTONE_EVERY, MEN_PER_WAVE, MAX_BOMBS,
  SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME, WAVE_BONUS_PER_MAN,
} from '../constants';
```

   with:

```ts
import { clearHazards } from './hazards';
import { addScore } from './scoring';
import {
  CEILING_Y, NMEYE_DELAY, NMEYE_REPEAT, MILESTONE_EVERY, MEN_PER_WAVE, MAX_BOMBS,
  SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME, WAVE_BONUS_PER_MAN,
} from '../constants';
```

2. Replace:

```ts
export function startWave(s: GameState, wave: number): void {
  s.wave = wave;
  s.waveTime = 0;
  s.nextHunterAt = HUNTER_DELAY;
  s.savedThisWave = 0;
  s.critical = false;
  s.phase = 'playing';
```

   with:

```ts
export function startWave(s: GameState, wave: number): void {
  s.wave = wave;
  s.waveTime = 0;
  s.nextNmeyeAt = NMEYE_DELAY;
  s.savedThisWave = 0;
  s.critical = false;
  s.phase = 'playing';
```

3. Replace:

```ts

export function updateWaveTimers(s: GameState, dt: number): void {
  s.waveTime += dt;
  while (s.waveTime >= s.nextHunterAt) {
    const side = chance(s.rng, 0.5) ? 1 : -1;
    const x = wrapX(s.player.x + side * VIEW_W * 0.7);
    const y = range(s.rng, SPAWN_MIN_Y, 400);
    s.enemies.push(createEnemy(s, 'hunter', x, y));
    s.nextHunterAt += HUNTER_REPEAT;
    emit(s, { type: 'hunterSpawned', x, y });
  }
}
```

   with:

```ts

export function updateWaveTimers(s: GameState, dt: number): void {
  s.waveTime += dt;
  while (s.waveTime >= s.nextNmeyeAt) {
    const side = chance(s.rng, 0.5) ? 1 : -1;
    const x = wrapX(s.player.x + side * VIEW_W * 0.7);
    const y = range(s.rng, SPAWN_MIN_Y, 400);
    s.enemies.push(createEnemy(s, 'nmeye', x, y));
    s.nextNmeyeAt += NMEYE_REPEAT;
    emit(s, { type: 'nmeyeSpawned', x, y });
  }
}
```

Edit `src/audio/eventAudio.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
          sfx.waveClear();
          break;
        case 'hunterSpawned':
          sfx.hunter();
          break;
        default:
```

   with:

```ts
          sfx.waveClear();
          break;
        case 'hunterSpawned':
        case 'nmeyeSpawned':
          sfx.hunter();
          break;
        default:
```

Edit `src/render/effects.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
        case 'hunterSpawned':
          this.ring(e.x, e.y, 90, PALETTE.hunter, 0.5);
          break;
        default:
          break;
      }
```

   with:

```ts
        case 'hunterSpawned':
          this.ring(e.x, e.y, 90, PALETTE.hunter, 0.5);
          break;
        case 'nmeyeSpawned':
          this.ring(e.x, e.y, 90, PALETTE.nmeye, 0.5);
          break;
        default:
          break;
      }
```

Edit `src/render/renderer.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts

  private drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    this.drawTethers(ctx, s, camX);
    for (const e of s.enemies) {
      const sx = toScreenX(e.x, camX);
      if (!onScreen(sx, 60)) continue;
      drawSprite(ctx, this.sprites[e.kind], sx, e.y, e.vx < 0);
    }
  }
```

   with:

```ts

  private drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    this.drawTethers(ctx, s, camX);
    const flash = Math.floor(s.time * 10) % 2 === 0;
    for (const e of s.enemies) {
      const sx = toScreenX(e.x, camX);
      if (!onScreen(sx, 60)) continue;
      if (e.kind === 'nmeye') {
        // The Nmeye flashes white as a warning.
        drawSprite(ctx, this.sprites.nmeye, sx, e.y, e.vx < 0, flash ? 1 : 0.6);
        if (flash) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, e.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      const angle = e.kind === 'antimatter' ? s.time * 6 : 0;
      drawSprite(ctx, this.sprites[e.kind], sx, e.y, e.vx < 0, 1, angle);
    }
  }
```

Edit `src/render/sprites.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  y: number,
  flipX = false,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half, sprite.half * 2, sprite.half * 2);
  ctx.restore();
```

   with:

```ts
  y: number,
  flipX = false,
  alpha = 1,
  angle = 0,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (angle !== 0) ctx.rotate(angle);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half, sprite.half * 2, sprite.half * 2);
  ctx.restore();
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 285 tests pass, no type errors.

- [ ] **Step 5: Browser check**

`npm run dev`: wait 60 s in wave 1; a flashing pink eye appears, zig-zags toward you fast and drops flashing bombs.

- [ ] **Step 6: Commit**

```bash
git add -A src/audio/eventAudio.ts src/game/constants.ts src/game/state.ts src/game/systems/ai/homers.ts src/game/systems/ai/index.ts src/game/systems/combat.ts src/game/systems/waves.ts src/render/effects.ts src/render/renderer.ts src/render/sprites.ts tests/audio/eventAudio.test.ts tests/game/sim.test.ts tests/game/systems/ai/homers.test.ts tests/game/systems/combat.test.ts tests/game/systems/waves.test.ts
git commit -m "feat: add Nemesite dodging, the Nmeye anti-camper and Antimatter orbits"
```

---

### Task 7: Spore and Trailer

Spore: drifts at speed 50 and bounces between ceiling and ground (generic integration), never fires; when killed it releases 4 Trailers flying out along the four diagonals. Trailer: homers steer at the player (turn rate 1.5); the others weave as in Phase 1 but no longer leave a hazard trail. Head-hit rule: a laser that hits the Trailer's tail half is absorbed (laser dies, Trailer survives, `laserBlocked` spark). The renderer draws a dim tail behind the bright head.

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/systems/ai/index.ts`
- Create: `src/game/systems/ai/spawners.ts`
- Modify: `src/game/systems/combat.ts`
- Modify: `src/render/effects.ts`
- Modify: `src/render/renderer.ts`
- Test (modify): `tests/game/systems/ai/index.test.ts`
- Test (create): `tests/game/systems/ai/spawners.test.ts`

**Interfaces:**
- Consumes: `createEnemy` (homer flag set in Task 2), `homeOnPlayer` (Task 5), `Laser`, `killEnemy`/`resolveLaserHits` in `combat.ts`.
- Produces:
  - `src/game/systems/ai/spawners.ts`:
    - `releaseTrailers(s: GameState, spore: Enemy): Enemy[]` (pushes 4 Trailers into `s.enemies` and returns them)
    - `updateTrailer(s: GameState, e: Enemy, dt: number): void` (moved out of `ai/index.ts`)
    - `trailerHeadHit(l: Laser, e: Enemy): boolean`
  - Constants `TRAILER_TURN_RATE = 1.5`, `TRAILER_AMPLITUDE = 80` (moved from `ai.ts`), `SPORE_TRAILERS = 4`
  - `killEnemy` calls `releaseTrailers` for Spores; `resolveLaserHits` applies the head-hit rule

- [ ] **Step 1: Write the failing tests**

Edit `tests/game/systems/ai/index.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
    expect(e.vy).toBeGreaterThan(0);
  });

  it('trailer leaves trail segments', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 3000, 300);
    e.fireTimer = Infinity;
    tick(s, 0.5);
    expect(s.trails.length).toBeGreaterThan(3);
  });
});
```

   with:

```ts
    expect(e.vy).toBeGreaterThan(0);
  });

  it('trailer no longer leaves trail segments', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 3000, 300);
    e.fireTimer = Infinity;
    tick(s, 0.5);
    expect(s.trails).toHaveLength(0);
  });
});
```

Create `tests/game/systems/ai/spawners.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../../src/game/state';
import { updateEnemies } from '../../../../src/game/systems/ai';
import { releaseTrailers, trailerHeadHit } from '../../../../src/game/systems/ai/spawners';
import { killEnemy, resolveLaserHits } from '../../../../src/game/systems/combat';
import { ENEMY_STATS } from '../../../../src/game/entities/enemies';
import { SIM_DT, CEILING_Y } from '../../../../src/game/constants';
import { addEnemy } from '../../helpers';

function tick(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

describe('spore', () => {
  it('drifts at speed 50, bounces off the ceiling and never fires', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'spore', 3000, CEILING_Y + 2);
    e.vx = 30;
    e.vy = -40;
    tick(s, 0.2);
    expect(e.vy).toBeGreaterThan(0);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(50);
    expect(e.fireTimer).toBe(Infinity);
    tick(s, 3);
    expect(s.shots).toHaveLength(0);
  });

  it('releases 4 Trailers at 90 degree intervals when killed', () => {
    const s = createGameState(1);
    const spore = addEnemy(s, 'spore', 3000, 300);
    killEnemy(s, spore);
    const trailers = s.enemies.filter((e) => e.kind === 'trailer');
    expect(trailers).toHaveLength(4);
    const quadrants = new Set(trailers.map((t) => `${Math.sign(t.vx)},${Math.sign(t.vy)}`));
    expect(quadrants.size).toBe(4);
    for (const t of trailers) {
      expect(t.x).toBe(3000);
      expect(t.y).toBe(300);
      expect(t.dead).toBe(false);
    }
    expect(s.score).toBe(ENEMY_STATS.spore.points);
  });

  it('releaseTrailers returns the new Trailers', () => {
    const s = createGameState(1);
    const spore = addEnemy(s, 'spore', 3000, 300);
    const out = releaseTrailers(s, spore);
    expect(out).toHaveLength(4);
    expect(s.enemies).toHaveLength(5);
  });
});

describe('trailer', () => {
  it('a homer turns toward the player', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', s.player.x + 500, s.player.y);
    e.homer = true;
    e.fireTimer = Infinity;
    e.vx = e.speed;
    tick(s, 2);
    expect(e.vx).toBeLessThan(0);
  });

  it('a non-homer weaves along its home line without leaving a trail', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 3000, 300);
    e.homer = false;
    e.fireTimer = Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let t = 0; t < 3; t += SIM_DT) {
      updateEnemies(s, SIM_DT);
      minY = Math.min(minY, e.y);
      maxY = Math.max(maxY, e.y);
    }
    expect(maxY - minY).toBeGreaterThan(100);
    expect(Math.abs(e.vx)).toBeCloseTo(e.speed);
    expect(s.trails).toHaveLength(0);
  });
});

describe('trailer head-hit rule', () => {
  it('a laser meeting the Trailer head-on kills it', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 2000, 300);
    e.vx = -200;
    s.lasers.push({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 });
    expect(trailerHeadHit(s.lasers[0], e)).toBe(true);
    resolveLaserHits(s);
    expect(e.dead).toBe(true);
    expect(s.score).toBe(ENEMY_STATS.trailer.points);
  });

  it('a laser hitting the tail is absorbed and the Trailer survives', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 2000, 300);
    e.vx = 200;
    s.lasers.push({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 });
    expect(trailerHeadHit(s.lasers[0], e)).toBe(false);
    resolveLaserHits(s);
    expect(e.dead).toBe(false);
    expect(s.lasers[0].life).toBe(0);
    expect(s.score).toBe(0);
    expect(s.events).toContainEqual({ type: 'laserBlocked', x: 2000, y: 300 });
  });

  it('a Trailer with no horizontal speed can be hit from either side', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 2000, 300);
    e.vx = 0;
    expect(trailerHeadHit({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 }, e)).toBe(true);
    expect(trailerHeadHit({ prevX: 2010, x: 1990, y: 300, vx: -2200, life: 0.3 }, e)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/game/systems/ai/index.test.ts tests/game/systems/ai/spawners.test.ts`
Expected: FAIL: `spawners.test.ts` cannot resolve `src/game/systems/ai/spawners`; `index.test.ts` "trailer no longer leaves trail segments" fails.

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const NMEYE_WOBBLE = 1;
export const ANTIMATTER_DRIFT = 160;
export const ANTIMATTER_SPIN = 3;

// Volcanoes (normal magma, and white-hot rocks while the planet is unstable)
export const MAGMA_RADIUS = 5;
```

   with:

```ts
export const NMEYE_WOBBLE = 1;
export const ANTIMATTER_DRIFT = 160;
export const ANTIMATTER_SPIN = 3;
export const TRAILER_TURN_RATE = 1.5;
export const TRAILER_AMPLITUDE = 80;
export const SPORE_TRAILERS = 4;

// Volcanoes (normal magma, and white-hot rocks while the planet is unstable)
export const MAGMA_RADIUS = 5;
```

Edit `src/game/systems/ai/index.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { findMan } from '../../query';
import { convertEnemy, resetFireTimer } from '../../entities/enemies';
import {
  CEILING_Y, SNATCH_CARRY_OFFSET, SNATCH_GRACE, TRAIL_LIFE, TRAIL_INTERVAL,
  ENEMY_SHOT_SPEED, ENEMY_SHOT_LIFE, ENEMY_FIRE_RANGE,
} from '../../constants';
import { playerVisible, homeOnPlayer } from './common';
import { updatePlanter, updateAndroid } from './planter';
import { updateNemesite, updateNmeye, updateAntimatter } from './homers';

const SNATCHER_SEEK_RANGE = 2500;
const GRAB_DISTANCE = 10;
const TRAILER_AMPLITUDE = 80;

/** Grace period over, abductor cap not reached, and at least one man is walking. */
function canPickTarget(s: GameState, e: Enemy): boolean {
```

   with:

```ts
import { findMan } from '../../query';
import { convertEnemy, resetFireTimer } from '../../entities/enemies';
import {
  CEILING_Y, SNATCH_CARRY_OFFSET, SNATCH_GRACE,
  ENEMY_SHOT_SPEED, ENEMY_SHOT_LIFE, ENEMY_FIRE_RANGE,
} from '../../constants';
import { playerVisible, homeOnPlayer } from './common';
import { updatePlanter, updateAndroid } from './planter';
import { updateNemesite, updateNmeye, updateAntimatter } from './homers';
import { updateTrailer } from './spawners';

const SNATCHER_SEEK_RANGE = 2500;
const GRAB_DISTANCE = 10;

/** Grace period over, abductor cap not reached, and at least one man is walking. */
function canPickTarget(s: GameState, e: Enemy): boolean {
```

2. Replace:

```ts
  }
  e.vx = (dx / dist) * e.speed;
  e.vy = (dy / dist) * e.speed;
}

function updateTrailer(s: GameState, e: Enemy, dt: number): void {
  e.vx = Math.sign(e.vx || 1) * e.speed;
  const targetY = e.homeY + Math.sin(e.phase * 2.5) * TRAILER_AMPLITUDE;
  e.vy = (targetY - e.y) * 6;
  e.trailTimer -= dt;
  if (e.trailTimer <= 0) {
    s.trails.push({ x: e.x, y: e.y, life: TRAIL_LIFE });
    e.trailTimer = TRAIL_INTERVAL;
  }
}

function integrate(s: GameState, e: Enemy, dt: number): void {
```

   with:

```ts
  }
  e.vx = (dx / dist) * e.speed;
  e.vy = (dy / dist) * e.speed;
}

function integrate(s: GameState, e: Enemy, dt: number): void {
```

Create `src/game/systems/ai/spawners.ts`:

```ts
import { clamp } from '../../../core/world';
import type { GameState, Enemy, Laser } from '../../state';
import { createEnemy } from '../../entities/enemies';
import { homeOnPlayer } from './common';
import { CEILING_Y, TRAILER_TURN_RATE, TRAILER_AMPLITUDE, SPORE_TRAILERS } from '../../constants';

const TRAILER_HOME_MIN = CEILING_Y + 90;
const TRAILER_HOME_MAX = 480;
const RELEASE_SPREAD = 60;

/** A dead Spore bursts into 4 Trailers flying out at 90° intervals (the four diagonals). */
export function releaseTrailers(s: GameState, spore: Enemy): Enemy[] {
  const out: Enemy[] = [];
  for (let i = 0; i < SPORE_TRAILERS; i++) {
    const a = Math.PI / 4 + (i * Math.PI * 2) / SPORE_TRAILERS;
    const t = createEnemy(s, 'trailer', spore.x, spore.y);
    t.vx = Math.sign(Math.cos(a)) * t.speed;
    t.vy = Math.sin(a) * t.speed;
    t.homeY = clamp(spore.y + Math.sin(a) * RELEASE_SPREAD, TRAILER_HOME_MIN, TRAILER_HOME_MAX);
    s.enemies.push(t);
    out.push(t);
  }
  return out;
}

/** Homers steer at the player; the rest weave along their home line. Trailers leave no hazard trail. */
export function updateTrailer(s: GameState, e: Enemy, dt: number): void {
  if (e.homer) {
    homeOnPlayer(s, e, dt, TRAILER_TURN_RATE);
    return;
  }
  e.vx = Math.sign(e.vx || 1) * e.speed;
  const targetY = e.homeY + Math.sin(e.phase * 2.5) * TRAILER_AMPLITUDE;
  e.vy = (targetY - e.y) * 6;
}

/**
 * Head-hit rule: a horizontal laser strikes the side of the Trailer facing the laser's origin.
 * That is the front half when the Trailer is flying toward the laser (or has no horizontal speed).
 */
export function trailerHeadHit(l: Laser, e: Enemy): boolean {
  return Math.sign(l.vx) * e.vx <= 0;
}
```

Edit `src/game/systems/combat.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { createEnemy, convertEnemy, killPoints } from '../entities/enemies';
import { laserHitsCircle, circlesOverlap } from './collision';
import { registerKill, resetCombo } from './scoring';
import {
  HITSTOP_MULTI, HITSTOP_HUNTER, PLAYER_RADIUS, MAN_RADIUS, TRAIL_RADIUS, RESPAWN_DELAY,
} from '../constants';
```

   with:

```ts
import { createEnemy, convertEnemy, killPoints } from '../entities/enemies';
import { laserHitsCircle, circlesOverlap } from './collision';
import { registerKill, resetCombo } from './scoring';
import { releaseTrailers, trailerHeadHit } from './ai/spawners';
import {
  HITSTOP_MULTI, HITSTOP_HUNTER, PLAYER_RADIUS, MAN_RADIUS, TRAIL_RADIUS, RESPAWN_DELAY,
} from '../constants';
```

2. Replace:

```ts
    }
  }

  if (e.kind === 'orb') {
    for (let i = 0; i < ORB_FRAGMENTS; i++) {
      const a = (i / ORB_FRAGMENTS) * Math.PI * 2 + range(s.rng, 0, 0.5);
```

   with:

```ts
    }
  }

  if (e.kind === 'spore') releaseTrailers(s, e);

  if (e.kind === 'orb') {
    for (let i = 0; i < ORB_FRAGMENTS; i++) {
      const a = (i / ORB_FRAGMENTS) * Math.PI * 2 + range(s.rng, 0, 0.5);
```

3. Replace:

```ts
    for (const e of s.enemies) {
      if (e.dead) continue;
      if (laserHitsCircle(l, e.x, e.y, e.radius)) {
        killEnemy(s, e);
        kills++;
        l.life = 0;
        break;
      }
    }
```

   with:

```ts
    for (const e of s.enemies) {
      if (e.dead) continue;
      if (laserHitsCircle(l, e.x, e.y, e.radius)) {
        l.life = 0;
        if (e.kind === 'trailer' && !trailerHeadHit(l, e)) {
          // Tail hit: the laser is absorbed and the Trailer survives.
          emit(s, { type: 'laserBlocked', x: e.x, y: e.y });
          break;
        }
        killEnemy(s, e);
        kills++;
        break;
      }
    }
```

Edit `src/render/effects.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
        case 'hunterSpawned':
          this.ring(e.x, e.y, 90, PALETTE.hunter, 0.5);
          break;
        case 'nmeyeSpawned':
          this.ring(e.x, e.y, 90, PALETTE.nmeye, 0.5);
          break;
```

   with:

```ts
        case 'hunterSpawned':
          this.ring(e.x, e.y, 90, PALETTE.hunter, 0.5);
          break;
        case 'laserBlocked':
          this.burst(e.x, e.y, PALETTE.laser, 8, 160);
          break;
        case 'nmeyeSpawned':
          this.ring(e.x, e.y, 90, PALETTE.nmeye, 0.5);
          break;
```

Edit `src/render/renderer.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
        }
        continue;
      }
      const angle = e.kind === 'antimatter' ? s.time * 6 : 0;
      drawSprite(ctx, this.sprites[e.kind], sx, e.y, e.vx < 0, 1, angle);
    }
```

   with:

```ts
        }
        continue;
      }
      if (e.kind === 'trailer') {
        // Dim tail behind the bright head: only head hits kill.
        const v = Math.hypot(e.vx, e.vy) || 1;
        ctx.strokeStyle = PALETTE.trailer;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(sx, e.y);
        ctx.lineTo(sx - (e.vx / v) * 26, e.y - (e.vy / v) * 26);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const angle = e.kind === 'antimatter' ? s.time * 6 : 0;
      drawSprite(ctx, this.sprites[e.kind], sx, e.y, e.vx < 0, 1, angle);
    }
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 293 tests pass, no type errors.

- [ ] **Step 5: Smoke check**

Run `npm run dev`, press Enter and play for 30 s: the game runs with no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A src/game/constants.ts src/game/systems/ai/index.ts src/game/systems/ai/spawners.ts src/game/systems/combat.ts src/render/effects.ts src/render/renderer.ts tests/game/systems/ai/index.test.ts tests/game/systems/ai/spawners.test.ts
git commit -m "feat: add Spores that burst into Trailers and the Trailer head-hit rule"
```

---

### Task 8: Blunderstorm

Blunderstorms drift slowly in the upper band (`STORM_BAND_TOP`..`STORM_BAND_BOTTOM`, bobbing ±20). Every 3–5 s each either drops 5 acid drops (16 px apart, 220 px/s) or emits `rumble` and 0.8 s later fires a proton bolt from just under the storm to the ground (12 px wide, 0.25 s). Acid and bolts use the Task 3 hazard system, so they are already lethal and drawn.

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/systems/ai/index.ts`
- Create: `src/game/systems/ai/storm.ts`
- Test (create): `tests/game/systems/ai/storm.test.ts`

**Interfaces:**
- Consumes: `s.acid`, `s.bolts` (Task 2), hazard movement/collision (Task 3), `ACID_SPEED`, `BOLT_LIFE`, `STORM_*` constants (Task 2), `range`, `chance`, `emit`, `groundYAt`.
- Produces:
  - `src/game/systems/ai/storm.ts`: `dropAcid(s: GameState, e: Enemy): void`, `fireBolt(s: GameState, e: Enemy): void`, `updateBlunderstorm(s: GameState, e: Enemy, dt: number): void`
  - Constants `STORM_ACID_DROPS = 5`, `STORM_ACID_SPACING = 16`, `STORM_BOLT_DELAY = 0.8`, `STORM_BOB = 20`
  - `ai/index.ts` dispatches `blunderstorm` (keep `orb`, `fragment`, `spore` in the no-op case; do NOT let them fall through into the storm case)

- [ ] **Step 1: Write the failing tests**

Create `tests/game/systems/ai/storm.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../../src/game/state';
import { updateEnemies } from '../../../../src/game/systems/ai';
import { groundYAt } from '../../../../src/game/terrain';
import {
  SIM_DT, STORM_BAND_TOP, STORM_BAND_BOTTOM, ACID_SPEED, BOLT_LIFE, STORM_BOLT_DELAY,
} from '../../../../src/game/constants';
import { addEnemy } from '../../helpers';

function tick(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

describe('blunderstorm drift', () => {
  it('stays in the upper band and never fires shots', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'blunderstorm', 3000, 400);
    expect(e.fireTimer).toBe(Infinity);
    for (let t = 0; t < 10; t += SIM_DT) {
      updateEnemies(s, SIM_DT);
      expect(e.y).toBeGreaterThanOrEqual(STORM_BAND_TOP - 1);
      expect(e.y).toBeLessThanOrEqual(STORM_BAND_BOTTOM + 1);
    }
    expect(s.shots).toHaveLength(0);
  });
});

describe('blunderstorm actions', () => {
  function storms(s: GameState, n: number) {
    return Array.from({ length: n }, (_, i) => {
      const e = addEnemy(s, 'blunderstorm', 1000 + i * 400, 150);
      e.actionTimer = SIM_DT / 2;
      return e;
    });
  }

  it('each action either drops 5 acid drops or rumbles, and the next comes 3-5 s later', () => {
    const s = createGameState(1);
    const list = storms(s, 20);
    updateEnemies(s, SIM_DT);
    const rumbles = s.events.filter((e) => e.type === 'rumble').length;
    const acidStorms = list.filter((e) => e.boltTimer === 0).length;
    expect(rumbles + acidStorms).toBe(20);
    expect(rumbles).toBeGreaterThan(0);
    expect(acidStorms).toBeGreaterThan(0);
    expect(s.acid).toHaveLength(acidStorms * 5);
    for (const a of s.acid) expect(a.vy).toBe(ACID_SPEED);
    for (const e of list) {
      expect(e.actionTimer).toBeGreaterThanOrEqual(3);
      expect(e.actionTimer).toBeLessThanOrEqual(5);
    }
  });

  it('fires a proton bolt from the storm to the ground 0.8 s after its rumble', () => {
    const s = createGameState(1);
    const list = storms(s, 20);
    updateEnemies(s, SIM_DT);
    const rumbler = list.find((e) => e.boltTimer > 0)!;
    expect(rumbler.boltTimer).toBe(STORM_BOLT_DELAY);
    tick(s, STORM_BOLT_DELAY - 0.05);
    expect(s.bolts).toHaveLength(0);
    tick(s, 0.1);
    const bolt = s.bolts.find((b) => Math.abs(b.x - rumbler.x) < 10);
    expect(bolt).toBeDefined();
    expect(bolt!.life).toBe(BOLT_LIFE);
    expect(bolt!.bottom).toBeCloseTo(groundYAt(s.terrain, bolt!.x));
    expect(bolt!.top).toBeLessThan(STORM_BAND_BOTTOM + 30);
    expect(s.events.some((e) => e.type === 'protonBolt')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/game/systems/ai/storm.test.ts`
Expected: FAIL: `storm.test.ts` cannot resolve `src/game/systems/ai/storm`.

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const TRAILER_TURN_RATE = 1.5;
export const TRAILER_AMPLITUDE = 80;
export const SPORE_TRAILERS = 4;

// Volcanoes (normal magma, and white-hot rocks while the planet is unstable)
export const MAGMA_RADIUS = 5;
```

   with:

```ts
export const TRAILER_TURN_RATE = 1.5;
export const TRAILER_AMPLITUDE = 80;
export const SPORE_TRAILERS = 4;
export const STORM_ACID_DROPS = 5;
export const STORM_ACID_SPACING = 16;
/** Seconds between a Blunderstorm's rumble and its proton bolt. */
export const STORM_BOLT_DELAY = 0.8;
export const STORM_BOB = 20;

// Volcanoes (normal magma, and white-hot rocks while the planet is unstable)
export const MAGMA_RADIUS = 5;
```

Edit `src/game/systems/ai/index.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { updatePlanter, updateAndroid } from './planter';
import { updateNemesite, updateNmeye, updateAntimatter } from './homers';
import { updateTrailer } from './spawners';

const SNATCHER_SEEK_RANGE = 2500;
const GRAB_DISTANCE = 10;
```

   with:

```ts
import { updatePlanter, updateAndroid } from './planter';
import { updateNemesite, updateNmeye, updateAntimatter } from './homers';
import { updateTrailer } from './spawners';
import { updateBlunderstorm } from './storm';

const SNATCHER_SEEK_RANGE = 2500;
const GRAB_DISTANCE = 10;
```

2. Replace:

```ts
      case 'android':
        updateAndroid(s, e, dt);
        break;
      case 'orb':
      case 'fragment':
      case 'spore':
      case 'blunderstorm':
        break;
    }
    integrate(s, e, dt);
```

   with:

```ts
      case 'android':
        updateAndroid(s, e, dt);
        break;
      case 'blunderstorm':
        updateBlunderstorm(s, e, dt);
        break;
      case 'orb':
      case 'fragment':
      case 'spore':
        break;
    }
    integrate(s, e, dt);
```

Create `src/game/systems/ai/storm.ts`:

```ts
import { clamp } from '../../../core/world';
import { range, chance } from '../../../core/rng';
import type { GameState, Enemy } from '../../state';
import { emit } from '../../events';
import { groundYAt } from '../../terrain';
import {
  STORM_BAND_TOP, STORM_BAND_BOTTOM, STORM_ACTION_MIN, STORM_ACTION_MAX, STORM_ACID_DROPS, STORM_ACID_SPACING,
  STORM_BOLT_DELAY, STORM_BOB, ACID_SPEED, BOLT_LIFE,
} from '../../constants';

export function dropAcid(s: GameState, e: Enemy): void {
  const mid = (STORM_ACID_DROPS - 1) / 2;
  for (let i = 0; i < STORM_ACID_DROPS; i++) {
    s.acid.push({ x: e.x + (i - mid) * STORM_ACID_SPACING, y: e.y + e.radius * 0.6, vy: ACID_SPEED });
  }
}

export function fireBolt(s: GameState, e: Enemy): void {
  const top = e.y + e.radius * 0.5;
  const bottom = groundYAt(s.terrain, e.x);
  s.bolts.push({ x: e.x, top, bottom, life: BOLT_LIFE });
  emit(s, { type: 'protonBolt', x: e.x, top, bottom });
}

/** Drifts in the upper band; every 3-5 s drops acid, or rumbles and fires a proton bolt 0.8 s later. */
export function updateBlunderstorm(s: GameState, e: Enemy, dt: number): void {
  e.vx = (e.vx < 0 ? -1 : 1) * e.speed;
  const targetY = clamp(e.homeY + Math.sin(e.phase * 0.8) * STORM_BOB, STORM_BAND_TOP, STORM_BAND_BOTTOM);
  e.vy = (targetY - e.y) * 2;

  if (e.boltTimer > 0) {
    e.boltTimer -= dt;
    if (e.boltTimer <= 0) {
      e.boltTimer = 0;
      fireBolt(s, e);
    }
  }

  e.actionTimer -= dt;
  if (e.actionTimer > 0) return;
  e.actionTimer = range(s.rng, STORM_ACTION_MIN, STORM_ACTION_MAX);
  if (chance(s.rng, 0.5)) {
    dropAcid(s, e);
  } else {
    emit(s, { type: 'rumble', x: e.x, y: e.y });
    e.boltTimer = STORM_BOLT_DELAY;
  }
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 296 tests pass, no type errors.

- [ ] **Step 5: Smoke check**

Run `npm run dev`, press Enter and play for 30 s: the game runs with no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A src/game/constants.ts src/game/systems/ai/index.ts src/game/systems/ai/storm.ts tests/game/systems/ai/storm.test.ts
git commit -m "feat: add the Blunderstorm (acid rain and proton bolts)"
```

---

### Task 9: Men walk to the base; planet unstable

Men walk toward the base by the shortest wrapped direction; at the lake or a lava-ditch edge they turn and walk away for 1–2 s, then head for the base again. A walking/chased man who reaches the pad (`|shortestDx| <= BASE_WIDTH/2`) rescues himself: `saved`, `savedThisWave++`, `manSelfRescued`, 0 points. Carried delivery scores min(500, 100 × wave) × multiplier (`rescuePoints`). A falling man dies on landing if he fell more than `MAN_SAFE_FALL` or lands in a lava ditch. Men never spawn within 280 px of the base or in the lake/lava.

`critical` is renamed `unstable` everywhere (`s.unstable`, `checkUnstable`, `PALETTE.terrainUnstable`, HUD "PLANET UNSTABLE"); `planetCritical` is removed in favour of `planetUnstable`. When the wave had men and all are dead: `s.unstable = true`, every living Planter and Android becomes an Antimatter on its orbit (other enemies are untouched; `makeAggressive` is no longer called), `planetUnstable` fires (klaxon + red flash), and volcanoes switch to white-hot mode.

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/state.ts`
- Modify: `src/game/events.ts`
- Modify: `src/game/systems/rescue.ts`
- Modify: `src/game/systems/volcanoes.ts`
- Modify: `src/game/systems/waves.ts`
- Modify: `src/game/update.ts`
- Modify: `src/audio/eventAudio.ts`
- Modify: `src/render/background.ts`
- Modify: `src/render/debug.ts`
- Modify: `src/render/effects.ts`
- Modify: `src/render/hud.ts`
- Modify: `src/render/palette.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/scenes/app.ts`
- Test (modify): `tests/audio/eventAudio.test.ts`
- Test (modify): `tests/game/sim.test.ts`
- Test (modify): `tests/game/systems/rescue.test.ts`
- Test (modify): `tests/game/systems/volcanoes.test.ts`
- Test (modify): `tests/game/systems/waves.test.ts`
- Test (modify): `tests/game/update.test.ts`

**Interfaces:**
- Consumes: `isLake`, `isLava` (Task 1), `convertEnemy`, `startOrbit` (Task 2), `awardBonus`, `emit`, white-hot volcano logic (Task 4), `chased` handling (Task 5).
- Produces:
  - `rescue.ts`: `spawnMen(s, count)`, `updateMen(s, dt)`, `canDeliver(s)` (unchanged signatures), new `rescuePoints(wave: number): number`, `checkUnstable(s: GameState): void` (replaces `checkCritical`)
  - `GameState.unstable: boolean` (replaces `critical`)
  - Constants `RESCUE_POINTS_PER_WAVE = 100`, `RESCUE_POINTS_CAP = 500` (replace `RESCUE_POINTS`), `MAN_TURN_MIN = 1`, `MAN_TURN_MAX = 2`
  - `Man.walkTimer` now means "seconds left walking away from an obstacle" (0 = heading for the base)

- [ ] **Step 1: Write the failing tests**

Edit `tests/audio/eventAudio.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
      { type: 'bombDetonated', x: 0, y: 0 },
      { type: 'playerDied', x: 0, y: 0 },
      { type: 'extraLife' },
      { type: 'planetCritical' },
      { type: 'cloakOn' },
      { type: 'cloakOff' },
      { type: 'waveCleared', wave: 1, bonus: 0, saved: 0 },
```

   with:

```ts
      { type: 'bombDetonated', x: 0, y: 0 },
      { type: 'playerDied', x: 0, y: 0 },
      { type: 'extraLife' },
      { type: 'planetUnstable' },
      { type: 'cloakOn' },
      { type: 'cloakOff' },
      { type: 'waveCleared', wave: 1, bonus: 0, saved: 0 },
```

Edit `tests/game/sim.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
});

describe('wave progression', () => {
  it('reaches wave 6 with a full set of men and a bonus bomb even after the planet went critical', () => {
    const s = newGame(42);
    s.lives = 99;
    let forced = false;
```

   with:

```ts
});

describe('wave progression', () => {
  it('reaches wave 6 with a full set of men and a bonus bomb even after the planet went unstable', () => {
    const s = newGame(42);
    s.lives = 99;
    let forced = false;
```

Replace the whole content of `tests/game/systems/rescue.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../src/game/state';
import { spawnMen, updateMen, canDeliver, checkUnstable, rescuePoints } from '../../../src/game/systems/rescue';
import { registerKill } from '../../../src/game/systems/scoring';
import {
  SIM_DT, MAN_CARRY_OFFSET, MAN_SAFE_FALL, MAN_RADIUS, CATCH_POINTS, PLAYER_RADIUS, SNATCH_CARRY_OFFSET,
  MAN_WALK_SPEED, BASE_WIDTH,
} from '../../../src/game/constants';
import { groundYAt, BASE_GROUND_Y } from '../../../src/game/terrain';
import { isLake, isLava } from '../../../src/game/landscape';
import { WORLD_W, shortestDx } from '../../../src/core/world';
import { addMan, addEnemy } from '../helpers';

function tick(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateMen(s, SIM_DT);
}

/** Lake at 4000 (3820..4180), lava ditch at 6000 (5968..6032), nothing else near the base. */
function testLandscape(s: GameState) {
  s.landscape = { volcanoes: [{ x: 8000, timer: 99 }], lakeX: 4000, ditches: [6000], craters: [9000] };
}

describe('spawnMen', () => {
  it('spawns walking men spread across the world on the ground', () => {
    const s = createGameState(1);
    spawnMen(s, 8);
    expect(s.men).toHaveLength(8);
    for (const m of s.men) {
      expect(m.state).toBe('walking');
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x).toBeLessThan(WORLD_W);
      expect(m.y).toBeCloseTo(groundYAt(s.terrain, m.x) - MAN_RADIUS);
    }
    const xs = s.men.map((m) => m.x).sort((a, b) => a - b);
    expect(xs[7] - xs[0]).toBeGreaterThan(WORLD_W / 2);
  });

  it('never spawns a man on or next to the base pad, in the lake or in a lava ditch', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = createGameState(seed);
      spawnMen(s, 8);
      for (const m of s.men) {
        expect(Math.abs(shortestDx(s.baseX, m.x))).toBeGreaterThanOrEqual(BASE_WIDTH / 2 + 200 - 1);
        expect(isLake(s.landscape, m.x)).toBe(false);
        expect(isLava(s.landscape, m.x)).toBe(false);
      }
    }
  });
});

describe('walking to the base', () => {
  it('walking men stay on the ground', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000);
    tick(s, 3);
    expect(m.y).toBeCloseTo(groundYAt(s.terrain, m.x) - MAN_RADIUS);
  });

  it('walk toward the base at the walking speed', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, 3000);
    m.walkTimer = 0;
    tick(s, 1);
    expect(m.dir).toBe(-1);
    expect(3000 - m.x).toBeCloseTo(MAN_WALK_SPEED, 0);
  });

  it('take the shortest wrapped direction', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, WORLD_W - 300);
    m.walkTimer = 0;
    tick(s, 1);
    expect(m.dir).toBe(1);
    expect(shortestDx(WORLD_W - 300, m.x)).toBeCloseTo(MAN_WALK_SPEED, 0);
  });

  it('turn back at the lake edge for 1-2 s, then head for the base again, never entering it', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, 4200);
    m.walkTimer = 0;
    let turned = false;
    for (let t = 0; t < 12; t += SIM_DT) {
      updateMen(s, SIM_DT);
      expect(isLake(s.landscape, m.x)).toBe(false);
      if (m.dir === 1) {
        turned = true;
        expect(m.walkTimer).toBeLessThanOrEqual(2);
      }
    }
    expect(turned).toBe(true);
    expect(m.x).toBeGreaterThan(4180);
    expect(m.x).toBeLessThan(4180 + 2 * MAN_WALK_SPEED + 1);
  });

  it('turn back at a lava ditch edge', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, 6060);
    m.walkTimer = 0;
    for (let t = 0; t < 6; t += SIM_DT) {
      updateMen(s, SIM_DT);
      expect(isLava(s.landscape, m.x)).toBe(false);
    }
    expect(m.x).toBeGreaterThan(6032);
  });

  it('a man who reaches the base pad rescues himself: survivor, no points', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, s.baseX + BASE_WIDTH / 2 + 5);
    m.walkTimer = 0;
    tick(s, 1);
    expect(m.state).toBe('saved');
    expect(s.savedThisWave).toBe(1);
    expect(s.score).toBe(0);
    expect(s.events.some((e) => e.type === 'manSelfRescued')).toBe(true);
  });
});

describe('pickup', () => {
  it('the player picks up a man by touching him', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000);
    s.player.x = m.x;
    s.player.y = m.y - PLAYER_RADIUS;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('carried');
    expect(s.player.carryingId).toBe(m.id);
    expect(s.events.some((e) => e.type === 'manPickedUp')).toBe(true);
  });

  it('cannot carry two men', () => {
    const s = createGameState(1);
    const a = addMan(s, 3000);
    const b = addMan(s, 3000);
    s.player.x = 3000;
    s.player.y = a.y - PLAYER_RADIUS;
    updateMen(s, SIM_DT);
    expect([a.state, b.state].filter((st) => st === 'carried')).toHaveLength(1);
  });

  it('a carried man hangs below the player', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'carried');
    s.player.carryingId = m.id;
    s.player.x = 3100;
    s.player.y = 300;
    updateMen(s, SIM_DT);
    expect(m.x).toBe(3100);
    expect(m.y).toBe(300 + MAN_CARRY_OFFSET);
  });
});

describe('delivery', () => {
  function deliverAt(s: GameState) {
    const m = addMan(s, s.baseX, 'carried');
    s.player.carryingId = m.id;
    s.player.x = s.baseX;
    s.player.y = BASE_GROUND_Y - PLAYER_RADIUS;
    return m;
  }

  it('delivering at the base saves the man and scores 100 x wave', () => {
    const s = createGameState(1);
    s.wave = 3;
    const m = deliverAt(s);
    expect(canDeliver(s)).toBe(true);
    updateMen(s, SIM_DT);
    expect(m.state).toBe('saved');
    expect(s.player.carryingId).toBeNull();
    expect(s.savedThisWave).toBe(1);
    expect(s.score).toBe(300);
    expect(s.events.some((e) => e.type === 'manRescued')).toBe(true);
  });

  it('the rescue bonus is capped at 500 and multiplied by the combo', () => {
    expect(rescuePoints(1)).toBe(100);
    expect(rescuePoints(5)).toBe(500);
    expect(rescuePoints(12)).toBe(500);
    const s = createGameState(1);
    s.wave = 7;
    registerKill(s, 0, 0, 0);
    registerKill(s, 0, 0, 0); // x2
    deliverAt(s);
    updateMen(s, SIM_DT);
    expect(s.score).toBe(1000);
  });

  it('flying high over the base does not deliver', () => {
    const s = createGameState(1);
    s.player.x = s.baseX;
    s.player.y = 200;
    expect(canDeliver(s)).toBe(false);
  });
});

describe('falling', () => {
  it('a man dropped from high up dies on landing', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'falling');
    const ground = groundYAt(s.terrain, 3000) - MAN_RADIUS;
    m.y = ground - MAN_SAFE_FALL - 50;
    m.fallStartY = m.y;
    s.player.x = 6000;
    tick(s, 3);
    expect(m.state).toBe('dead');
    expect(s.events.some((e) => e.type === 'manDied')).toBe(true);
  });

  it('a short fall is survivable', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'falling');
    const ground = groundYAt(s.terrain, 3000) - MAN_RADIUS;
    m.y = ground - 50;
    m.fallStartY = m.y;
    s.player.x = 6000;
    tick(s, 2);
    expect(m.state).toBe('walking');
  });

  it('a short fall into a lava ditch kills him', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, 6000, 'falling');
    const ground = groundYAt(s.terrain, 6000) - MAN_RADIUS;
    m.y = ground - 20;
    m.fallStartY = m.y;
    s.player.x = 9000;
    tick(s, 2);
    expect(m.state).toBe('dead');
  });

  it('catching a falling man scores a bonus and carries him', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'falling');
    m.y = 300;
    m.fallStartY = 300;
    s.player.x = 3000;
    s.player.y = 300;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('carried');
    expect(s.player.carryingId).toBe(m.id);
    expect(s.score).toBe(CATCH_POINTS);
    expect(s.events.some((e) => e.type === 'manCaught')).toBe(true);
  });
});

describe('snatched', () => {
  it('follows the holder and falls when the holder is gone', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'snatched');
    const e = addEnemy(s, 'snatcher', 3050, 250);
    m.holderId = e.id;
    updateMen(s, SIM_DT);
    expect(m.x).toBe(3050);
    expect(m.y).toBe(250 + SNATCH_CARRY_OFFSET);
    e.dead = true;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('falling');
  });
});

describe('chased', () => {
  it('a chased man keeps walking and can be picked up', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'chased');
    const a = addEnemy(s, 'android', 3500, 600);
    a.targetId = m.id;
    m.holderId = a.id;
    tick(s, 0.5);
    expect(m.state).toBe('chased');
    expect(m.x).not.toBe(3000);
    s.player.x = m.x;
    s.player.y = m.y - PLAYER_RADIUS;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('carried');
    expect(m.holderId).toBeNull();
  });

  it('goes back to walking when his Android is gone', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'chased');
    const a = addEnemy(s, 'android', 3500, 600);
    a.targetId = m.id;
    m.holderId = a.id;
    a.dead = true;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('walking');
    expect(m.holderId).toBeNull();
  });
});

describe('checkUnstable', () => {
  it('goes unstable when every man is dead, turning Planters and Androids into Antimatter', () => {
    const s = createGameState(1);
    const a = addMan(s, 1000, 'dead');
    addMan(s, 2000, 'dead');
    const planter = addEnemy(s, 'planter', 4000, 300);
    const android = addEnemy(s, 'android', 5000, 600);
    const nemesite = addEnemy(s, 'nemesite', 6000, 300);
    checkUnstable(s);
    expect(s.unstable).toBe(true);
    expect(s.menRemaining).toBe(0);
    expect(planter.kind).toBe('antimatter');
    expect(android.kind).toBe('antimatter');
    expect(planter.orbitX).toBeCloseTo(4000 - 80);
    expect(nemesite.kind).toBe('nemesite');
    expect(s.events.filter((ev) => ev.type === 'planetUnstable')).toHaveLength(1);
    a.state = 'dead';
    checkUnstable(s);
    expect(s.events.filter((ev) => ev.type === 'planetUnstable')).toHaveLength(1);
  });

  it('does not go unstable if any man was saved or is alive', () => {
    const s = createGameState(1);
    addMan(s, 1000, 'dead');
    addMan(s, 2000, 'saved');
    checkUnstable(s);
    expect(s.unstable).toBe(false);
  });

  it('does not go unstable in a wave with no men', () => {
    const s = createGameState(1);
    checkUnstable(s);
    expect(s.unstable).toBe(false);
  });
});
```

Edit `tests/game/systems/volcanoes.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
describe('erupt (white-hot mode)', () => {
  it('throws 2-3 bigger, faster rocks every 1-1.8 s when the planet is unstable', () => {
    const s = createGameState(1);
    s.critical = true;
    const v = oneVolcano(s, 0);
    for (let i = 0; i < 40; i++) {
      s.magma = [];
```

   with:

```ts
describe('erupt (white-hot mode)', () => {
  it('throws 2-3 bigger, faster rocks every 1-1.8 s when the planet is unstable', () => {
    const s = createGameState(1);
    s.unstable = true;
    const v = oneVolcano(s, 0);
    for (let i = 0; i < 40; i++) {
      s.magma = [];
```

2. Replace:

```ts
  it('a long normal timer is cut to the hot interval once the planet goes unstable', () => {
    const s = createGameState(1);
    oneVolcano(s, 4);
    s.critical = true;
    updateVolcanoes(s, HOT_INTERVAL_MAX + 0.01);
    expect(s.magma.length).toBeGreaterThanOrEqual(2);
  });
```

   with:

```ts
  it('a long normal timer is cut to the hot interval once the planet goes unstable', () => {
    const s = createGameState(1);
    oneVolcano(s, 4);
    s.unstable = true;
    updateVolcanoes(s, HOT_INTERVAL_MAX + 0.01);
    expect(s.magma.length).toBeGreaterThanOrEqual(2);
  });
```

Edit `tests/game/systems/waves.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts

  it('resets per-wave state', () => {
    const s = createGameState(1);
    s.critical = true;
    s.savedThisWave = 4;
    s.player.cloak = 0;
    s.shots.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
    startWave(s, 2);
    expect(s.critical).toBe(false);
    expect(s.savedThisWave).toBe(0);
    expect(s.player.cloak).toBe(1);
    expect(s.shots).toHaveLength(0);
```

   with:

```ts

  it('resets per-wave state', () => {
    const s = createGameState(1);
    s.unstable = true;
    s.savedThisWave = 4;
    s.player.cloak = 0;
    s.shots.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
    startWave(s, 2);
    expect(s.unstable).toBe(false);
    expect(s.savedThisWave).toBe(0);
    expect(s.player.cloak).toBe(1);
    expect(s.shots).toHaveLength(0);
```

2. Replace:

```ts
    expect(s.nextNmeyeAt).toBe(NMEYE_DELAY);
  });

  it('spawns no men after the planet went critical', () => {
    const s = createGameState(1);
    s.menRemaining = 0;
    startWave(s, 3);
```

   with:

```ts
    expect(s.nextNmeyeAt).toBe(NMEYE_DELAY);
  });

  it('spawns no men after the planet went unstable', () => {
    const s = createGameState(1);
    s.menRemaining = 0;
    startWave(s, 3);
```

Edit `tests/game/update.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { NO_ACTIONS } from '../../src/core/input';
import { update } from '../../src/game/update';
import { newGame } from '../../src/game/systems/waves';
import { SIM_DT, RESCUE_POINTS, PLAYER_RADIUS } from '../../src/game/constants';
import { BASE_GROUND_Y } from '../../src/game/terrain';
import { addMan, addEnemy } from './helpers';
```

   with:

```ts
import { NO_ACTIONS } from '../../src/core/input';
import { update } from '../../src/game/update';
import { newGame } from '../../src/game/systems/waves';
import { SIM_DT, PLAYER_RADIUS } from '../../src/game/constants';
import { BASE_GROUND_Y } from '../../src/game/terrain';
import { addMan, addEnemy } from './helpers';
```

2. Replace:

```ts

  it('delivering a man through update scores the rescue', () => {
    const s = createGameState(1);
    addEnemy(s, 'orb', 6000, 300);
    const m = addMan(s, s.baseX, 'carried');
    s.player.carryingId = m.id;
    s.player.y = BASE_GROUND_Y - PLAYER_RADIUS;
    update(s, NO_ACTIONS, SIM_DT);
    expect(m.state).toBe('saved');
    expect(s.score).toBe(RESCUE_POINTS);
  });

  it('a cleared wave advances to the next wave', () => {
```

   with:

```ts

  it('delivering a man through update scores the rescue', () => {
    const s = createGameState(1);
    s.wave = 2;
    addEnemy(s, 'orb', 6000, 300);
    const m = addMan(s, s.baseX, 'carried');
    s.player.carryingId = m.id;
    s.player.y = BASE_GROUND_Y - PLAYER_RADIUS;
    update(s, NO_ACTIONS, SIM_DT);
    expect(m.state).toBe('saved');
    expect(s.score).toBe(200);
  });

  it('a cleared wave advances to the next wave', () => {
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/audio/eventAudio.test.ts tests/game/sim.test.ts tests/game/systems/rescue.test.ts tests/game/systems/volcanoes.test.ts tests/game/systems/waves.test.ts tests/game/update.test.ts`
Expected: FAIL: `rescue.test.ts` cannot import `checkUnstable`/`rescuePoints`; other edited tests reference `s.unstable`.

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const MAN_WALK_SPEED = 18;
export const MAN_FALL_GRAVITY = 300;
export const MAN_SAFE_FALL = 200;
export const MAN_CARRY_OFFSET = 26;
export const SNATCH_CARRY_OFFSET = 20;
export const RESCUE_POINTS = 500;
export const CATCH_POINTS = 250;
export const BASE_WIDTH = 160;
/** Player must be within this height above the pad surface to deliver a man. */
```

   with:

```ts
export const MAN_WALK_SPEED = 18;
export const MAN_FALL_GRAVITY = 300;
export const MAN_SAFE_FALL = 200;
/** A man who reaches the lake or a lava ditch walks back for this long (s) before heading for the base again. */
export const MAN_TURN_MIN = 1;
export const MAN_TURN_MAX = 2;
export const MAN_CARRY_OFFSET = 26;
export const SNATCH_CARRY_OFFSET = 20;
/** Carried delivery scores 100 x wave, capped at 500. */
export const RESCUE_POINTS_PER_WAVE = 100;
export const RESCUE_POINTS_CAP = 500;
export const CATCH_POINTS = 250;
export const BASE_WIDTH = 160;
/** Player must be within this height above the pad surface to deliver a man. */
```

Edit `src/game/state.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  multiplier: number;
  comboTimer: number;
  hitStop: number;
  critical: boolean;
  /** Men to spawn at the start of the next wave. */
  menRemaining: number;
  savedThisWave: number;
```

   with:

```ts
  multiplier: number;
  comboTimer: number;
  hitStop: number;
  unstable: boolean;
  /** Men to spawn at the start of the next wave. */
  menRemaining: number;
  savedThisWave: number;
```

2. Replace:

```ts
    multiplier: 1,
    comboTimer: 0,
    hitStop: 0,
    critical: false,
    menRemaining: MEN_PER_WAVE,
    savedThisWave: 0,
    lastWaveBonus: 0,
```

   with:

```ts
    multiplier: 1,
    comboTimer: 0,
    hitStop: 0,
    unstable: false,
    menRemaining: MEN_PER_WAVE,
    savedThisWave: 0,
    lastWaveBonus: 0,
```

Replace the whole content of `src/game/events.ts` with:

```ts
import type { EnemyKind } from './state';

export type ExplosionSource = EnemyKind | 'player' | 'man';

export type GameEvent =
  | { type: 'laserFired'; x: number; y: number; facing: 1 | -1 }
  | { type: 'enemyShot'; x: number; y: number }
  | { type: 'explosion'; x: number; y: number; source: ExplosionSource; big: boolean }
  | { type: 'scorePopup'; x: number; y: number; points: number; multiplier: number }
  | { type: 'manPickedUp'; x: number; y: number }
  | { type: 'manCaught'; x: number; y: number }
  | { type: 'manRescued'; x: number; y: number }
  | { type: 'manDied'; x: number; y: number }
  | { type: 'manSnatched'; x: number; y: number }
  | { type: 'playerDied'; x: number; y: number }
  | { type: 'playerRespawned'; x: number; y: number }
  | { type: 'bombDetonated'; x: number; y: number }
  | { type: 'cloakOn' }
  | { type: 'cloakOff' }
  | { type: 'waveStarted'; wave: number }
  | { type: 'waveCleared'; wave: number; bonus: number; saved: number }
  | { type: 'hunterSpawned'; x: number; y: number }
  | { type: 'extraLife' }
  | { type: 'manWhistle'; x: number; y: number }
  | { type: 'manSelfRescued'; x: number; y: number }
  | { type: 'nemesiteWarning'; x: number; y: number }
  | { type: 'rumble'; x: number; y: number }
  | { type: 'protonBolt'; x: number; top: number; bottom: number }
  | { type: 'volcanoErupt'; x: number; y: number; whiteHot: boolean }
  | { type: 'planetUnstable' }
  | { type: 'invasionWave'; wave: number }
  | { type: 'nmeyeSpawned'; x: number; y: number }
  | { type: 'laserBlocked'; x: number; y: number }
  | { type: 'gameOver'; score: number };

export function emit(target: { events: GameEvent[] }, e: GameEvent): void {
  target.events.push(e);
}
```

Replace the whole content of `src/game/systems/rescue.ts` with:

```ts
import { WORLD_W, wrapX, shortestDx } from '../../core/world';
import { range, chance } from '../../core/rng';
import { allocId, type GameState, type Man } from '../state';
import { emit } from '../events';
import { groundYAt, BASE_GROUND_Y } from '../terrain';
import { isLake, isLava } from '../landscape';
import { findEnemy } from '../query';
import { convertEnemy, startOrbit } from '../entities/enemies';
import { circlesOverlap } from './collision';
import { awardBonus } from './scoring';
import {
  MAN_RADIUS, MAN_WALK_SPEED, MAN_FALL_GRAVITY, MAN_SAFE_FALL, MAN_CARRY_OFFSET, SNATCH_CARRY_OFFSET,
  PLAYER_RADIUS, RESCUE_POINTS_PER_WAVE, RESCUE_POINTS_CAP, CATCH_POINTS, BASE_WIDTH, BASE_DELIVERY_HEIGHT,
  MAN_TURN_MIN, MAN_TURN_MAX,
} from '../constants';

const CATCH_SLOP = 4;
/** Men never spawn closer than this to the base pad edge. */
const SPAWN_BASE_CLEAR = 200;
const SPAWN_HAZARD_CLEAR = 24;

/** Moves a spawn x off the base pad surroundings and out of the lake or a lava ditch. */
function safeSpawnX(s: GameState, x: number): number {
  const dBase = shortestDx(s.baseX, x);
  const minBase = BASE_WIDTH / 2 + SPAWN_BASE_CLEAR;
  if (Math.abs(dBase) < minBase) x = wrapX(s.baseX + (dBase < 0 ? -1 : 1) * minBase);
  for (let i = 0; i < 40 && (isLake(s.landscape, x) || isLava(s.landscape, x)); i++) {
    x = wrapX(x + SPAWN_HAZARD_CLEAR);
  }
  return x;
}

export function spawnMen(s: GameState, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = safeSpawnX(s, wrapX((i + 0.5) * (WORLD_W / count) + range(s.rng, -200, 200)));
    s.men.push({
      id: allocId(s),
      x,
      y: groundYAt(s.terrain, x) - MAN_RADIUS,
      vy: 0,
      dir: chance(s.rng, 0.5) ? 1 : -1,
      state: 'walking',
      fallStartY: 0,
      holderId: null,
      walkTimer: 0,
    });
  }
}

export function canDeliver(s: GameState): boolean {
  const p = s.player;
  return (
    p.alive &&
    Math.abs(shortestDx(p.x, s.baseX)) <= BASE_WIDTH / 2 &&
    p.y >= BASE_GROUND_Y - BASE_DELIVERY_HEIGHT
  );
}

function startFalling(m: Man): void {
  m.state = 'falling';
  m.holderId = null;
  m.vy = 0;
  m.fallStartY = m.y;
}

function blockedAt(s: GameState, x: number): boolean {
  return isLake(s.landscape, x) || isLava(s.landscape, x);
}

/**
 * Walks toward the base by the shortest wrapped direction. At the edge of the lake or a lava
 * ditch the man turns back and walks away for 1-2 s (walkTimer), then heads for the base again.
 */
function walk(s: GameState, m: Man, dt: number): void {
  if (m.walkTimer > 0) m.walkTimer = Math.max(0, m.walkTimer - dt);
  else m.dir = shortestDx(m.x, s.baseX) < 0 ? -1 : 1;
  const nx = wrapX(m.x + m.dir * MAN_WALK_SPEED * dt);
  if (blockedAt(s, nx) && !blockedAt(s, m.x)) {
    m.dir = m.dir === 1 ? -1 : 1;
    m.walkTimer = range(s.rng, MAN_TURN_MIN, MAN_TURN_MAX);
  } else {
    m.x = nx;
  }
  m.y = groundYAt(s.terrain, m.x) - MAN_RADIUS;
}

/** A man who walks onto the base pad rescues himself: a survivor, but no points. */
function checkSelfRescue(s: GameState, m: Man): boolean {
  if (Math.abs(shortestDx(m.x, s.baseX)) > BASE_WIDTH / 2) return false;
  m.state = 'saved';
  m.holderId = null;
  s.savedThisWave++;
  emit(s, { type: 'manSelfRescued', x: m.x, y: m.y });
  return true;
}

/** Carried delivery: 100 x wave, capped at 500 (the combo multiplier applies on top). */
export function rescuePoints(wave: number): number {
  return Math.min(RESCUE_POINTS_CAP, RESCUE_POINTS_PER_WAVE * Math.max(1, wave));
}

/** True while the Android recorded in holderId still exists and is chasing this man. */
function isChasedBy(s: GameState, m: Man): boolean {
  const a = m.holderId !== null ? findEnemy(s, m.holderId) : undefined;
  return a !== undefined && a.kind === 'android' && a.targetId === m.id;
}

function playerCanTake(s: GameState): boolean {
  return s.player.alive && s.player.carryingId === null;
}

function updateCarried(s: GameState, m: Man): void {
  const p = s.player;
  if (p.carryingId !== m.id) {
    startFalling(m);
    return;
  }
  m.x = p.x;
  m.y = Math.min(p.y + MAN_CARRY_OFFSET, groundYAt(s.terrain, p.x) - MAN_RADIUS);
  if (canDeliver(s)) {
    m.state = 'saved';
    p.carryingId = null;
    s.savedThisWave++;
    awardBonus(s, rescuePoints(s.wave), m.x, m.y);
    emit(s, { type: 'manRescued', x: m.x, y: m.y });
  }
}

function updateSnatched(s: GameState, m: Man): void {
  const holder = m.holderId !== null ? findEnemy(s, m.holderId) : undefined;
  if (!holder) {
    startFalling(m);
    return;
  }
  m.x = holder.x;
  m.y = holder.y + SNATCH_CARRY_OFFSET;
}

function updateFalling(s: GameState, m: Man, dt: number): void {
  const p = s.player;
  m.vy += MAN_FALL_GRAVITY * dt;
  m.y += m.vy * dt;

  if (playerCanTake(s) && circlesOverlap(p.x, p.y, PLAYER_RADIUS + CATCH_SLOP, m.x, m.y, MAN_RADIUS)) {
    m.state = 'carried';
    m.vy = 0;
    p.carryingId = m.id;
    awardBonus(s, CATCH_POINTS, m.x, m.y);
    emit(s, { type: 'manCaught', x: m.x, y: m.y });
    return;
  }

  const ground = groundYAt(s.terrain, m.x) - MAN_RADIUS;
  if (m.y >= ground) {
    m.y = ground;
    m.vy = 0;
    if (ground - m.fallStartY > MAN_SAFE_FALL || isLava(s.landscape, m.x)) {
      m.state = 'dead';
      emit(s, { type: 'manDied', x: m.x, y: m.y });
      emit(s, { type: 'explosion', x: m.x, y: m.y, source: 'man', big: false });
    } else {
      m.state = 'walking';
    }
  }
}

function updateWalking(s: GameState, m: Man, dt: number): void {
  const p = s.player;
  walk(s, m, dt);
  if (checkSelfRescue(s, m)) return;
  if (playerCanTake(s) && circlesOverlap(p.x, p.y, PLAYER_RADIUS, m.x, m.y, MAN_RADIUS)) {
    m.state = 'carried';
    m.holderId = null;
    p.carryingId = m.id;
    emit(s, { type: 'manPickedUp', x: m.x, y: m.y });
  }
}

export function updateMen(s: GameState, dt: number): void {
  for (const m of s.men) {
    switch (m.state) {
      case 'chased':
        // A chased man keeps walking (and can be picked up); he calms down once his Android is gone.
        if (!isChasedBy(s, m)) {
          m.state = 'walking';
          m.holderId = null;
        }
        updateWalking(s, m, dt);
        break;
      case 'walking':
        updateWalking(s, m, dt);
        break;
      case 'carried':
        updateCarried(s, m);
        break;
      case 'snatched':
        updateSnatched(s, m);
        break;
      case 'falling':
        updateFalling(s, m, dt);
        break;
      case 'saved':
      case 'dead':
        break;
    }
  }
}

/** Planet unstable: the wave had men and every one of them is dead. */
export function checkUnstable(s: GameState): void {
  if (s.unstable || s.men.length === 0) return;
  if (!s.men.every((m) => m.state === 'dead')) return;
  s.unstable = true;
  s.menRemaining = 0;
  for (const e of s.enemies) {
    if (e.dead || (e.kind !== 'planter' && e.kind !== 'android')) continue;
    convertEnemy(s, e, 'antimatter');
    startOrbit(e);
  }
  emit(s, { type: 'planetUnstable' });
}
```

Edit `src/game/systems/volcanoes.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts

/** Volcanoes go white-hot while the planet is unstable. */
function whiteHot(s: GameState): boolean {
  return s.critical;
}

/** Lobs magma (or white-hot rocks) out of a volcano's crater and resets its timer. */
```

   with:

```ts

/** Volcanoes go white-hot while the planet is unstable. */
function whiteHot(s: GameState): boolean {
  return s.unstable;
}

/** Lobs magma (or white-hot rocks) out of a volcano's crater and resets its timer. */
```

Edit `src/game/systems/waves.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  s.waveTime = 0;
  s.nextNmeyeAt = NMEYE_DELAY;
  s.savedThisWave = 0;
  s.critical = false;
  s.phase = 'playing';
  s.phaseTimer = 0;
```

   with:

```ts
  s.waveTime = 0;
  s.nextNmeyeAt = NMEYE_DELAY;
  s.savedThisWave = 0;
  s.unstable = false;
  s.phase = 'playing';
  s.phaseTimer = 0;
```

Edit `src/game/update.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { updatePlayerMovement, updatePlayerTimers } from './systems/player';
import { updateFiring, updateLasers } from './systems/weapons';
import { updateEnemies, updateShots, updateTrails } from './systems/ai';
import { updateMen, checkCritical } from './systems/rescue';
import { resolveLaserHits, resolvePlayerHits, pruneDead } from './systems/combat';
import { tickCombo } from './systems/scoring';
import { updateWaveTimers, checkWaveClear, updateWavePhase } from './systems/waves';
```

   with:

```ts
import { updatePlayerMovement, updatePlayerTimers } from './systems/player';
import { updateFiring, updateLasers } from './systems/weapons';
import { updateEnemies, updateShots, updateTrails } from './systems/ai';
import { updateMen, checkUnstable } from './systems/rescue';
import { resolveLaserHits, resolvePlayerHits, pruneDead } from './systems/combat';
import { tickCombo } from './systems/scoring';
import { updateWaveTimers, checkWaveClear, updateWavePhase } from './systems/waves';
```

2. Replace:

```ts
  resolveLaserHits(s);
  resolvePlayerHits(s);
  resolveHazardHits(s);
  checkCritical(s);
  tickCombo(s, dt);
  updateWaveTimers(s, dt);
  pruneDead(s);
```

   with:

```ts
  resolveLaserHits(s);
  resolvePlayerHits(s);
  resolveHazardHits(s);
  checkUnstable(s);
  tickCombo(s, dt);
  updateWaveTimers(s, dt);
  pruneDead(s);
```

Edit `src/audio/eventAudio.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
        case 'extraLife':
          sfx.extraLife();
          break;
        case 'planetCritical':
          sfx.klaxon();
          break;
        case 'cloakOn':
```

   with:

```ts
        case 'extraLife':
          sfx.extraLife();
          break;
        case 'planetUnstable':
          sfx.klaxon();
          break;
        case 'cloakOn':
```

Edit `src/render/background.ts` (5 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
    this.mountains = Array.from({ length: MOUNTAIN_POINTS }, () => range(rng, 470, 560));
  }

  drawSky(ctx: CanvasRenderingContext2D, critical: boolean): void {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, critical ? '#1a0005' : '#02010a');
    g.addColorStop(1, critical ? '#3a0010' : '#0a0630');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const n = ctx.createRadialGradient(VIEW_W * 0.7, 250, 20, VIEW_W * 0.7, 250, 420);
    n.addColorStop(0, critical ? 'rgba(255,40,80,0.12)' : 'rgba(120,60,255,0.10)');
    n.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = n;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
```

   with:

```ts
    this.mountains = Array.from({ length: MOUNTAIN_POINTS }, () => range(rng, 470, 560));
  }

  drawSky(ctx: CanvasRenderingContext2D, unstable: boolean): void {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, unstable ? '#1a0005' : '#02010a');
    g.addColorStop(1, unstable ? '#3a0010' : '#0a0630');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const n = ctx.createRadialGradient(VIEW_W * 0.7, 250, 20, VIEW_W * 0.7, 250, 420);
    n.addColorStop(0, unstable ? 'rgba(255,40,80,0.12)' : 'rgba(120,60,255,0.10)');
    n.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = n;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
```

2. Replace:

```ts
    return this.mountains[i0] + (this.mountains[i1] - this.mountains[i0]) * t;
  }

  drawMountains(ctx: CanvasRenderingContext2D, camX: number, critical: boolean): void {
    const origin = camX * MOUNTAIN_FACTOR - VIEW_W / 2;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
```

   with:

```ts
    return this.mountains[i0] + (this.mountains[i1] - this.mountains[i0]) * t;
  }

  drawMountains(ctx: CanvasRenderingContext2D, camX: number, unstable: boolean): void {
    const origin = camX * MOUNTAIN_FACTOR - VIEW_W / 2;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
```

3. Replace:

```ts
    }
    ctx.lineTo(VIEW_W + MOUNTAIN_STEP, VIEW_H);
    ctx.closePath();
    ctx.fillStyle = critical ? '#1c0410' : '#0b0a2a';
    ctx.fill();
    ctx.strokeStyle = critical ? 'rgba(255,60,90,0.35)' : 'rgba(90,90,200,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawTerrain(ctx: CanvasRenderingContext2D, terrain: number[], camX: number, critical: boolean): void {
    const left = camX - VIEW_W / 2;
    const i0 = Math.floor(left / TERRAIN_STEP) - 1;
    const count = Math.ceil(VIEW_W / TERRAIN_STEP) + 3;
```

   with:

```ts
    }
    ctx.lineTo(VIEW_W + MOUNTAIN_STEP, VIEW_H);
    ctx.closePath();
    ctx.fillStyle = unstable ? '#1c0410' : '#0b0a2a';
    ctx.fill();
    ctx.strokeStyle = unstable ? 'rgba(255,60,90,0.35)' : 'rgba(90,90,200,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawTerrain(ctx: CanvasRenderingContext2D, terrain: number[], camX: number, unstable: boolean): void {
    const left = camX - VIEW_W / 2;
    const i0 = Math.floor(left / TERRAIN_STEP) - 1;
    const count = Math.ceil(VIEW_W / TERRAIN_STEP) + 3;
```

4. Replace:

```ts
      const wx = (i0 + k) * TERRAIN_STEP;
      pts.push([wx - left, groundYAt(terrain, wx)]);
    }
    const color = critical ? PALETTE.terrainCritical : PALETTE.terrain;

    // Fill under the ridge
    ctx.beginPath();
```

   with:

```ts
      const wx = (i0 + k) * TERRAIN_STEP;
      pts.push([wx - left, groundYAt(terrain, wx)]);
    }
    const color = unstable ? PALETTE.terrainUnstable : PALETTE.terrain;

    // Fill under the ridge
    ctx.beginPath();
```

5. Replace:

```ts
    ctx.lineTo(pts[pts.length - 1][0], VIEW_H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 560, 0, VIEW_H);
    g.addColorStop(0, critical ? 'rgba(80,0,20,0.9)' : 'rgba(10,20,70,0.9)');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fill();
```

   with:

```ts
    ctx.lineTo(pts[pts.length - 1][0], VIEW_H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 560, 0, VIEW_H);
    g.addColorStop(0, unstable ? 'rgba(80,0,20,0.9)' : 'rgba(10,20,70,0.9)');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fill();
```

Replace the whole content of `src/render/debug.ts` with:

```ts
import { VIEW_W, SCANNER_H, toScreenX } from '../core/world';
import type { GameState } from '../game/state';
import { MAN_RADIUS, PLAYER_RADIUS } from '../game/constants';

const DEBUG_COLOR = '#7cfc00';

export function drawDebug(ctx: CanvasRenderingContext2D, s: GameState, camX: number, fps: number, particles: number): void {
  const aliveMen = s.men.filter((m) => m.state !== 'dead' && m.state !== 'saved').length;
  const lines = [
    `FPS ${fps.toFixed(0)}`,
    `SEED ${s.seed}`,
    `WAVE ${s.wave}  T ${s.waveTime.toFixed(1)}`,
    `ENEMIES ${s.enemies.length}`,
    `SHOTS ${s.shots.length}  TRAILS ${s.trails.length}`,
    `MEN ${aliveMen}/${s.men.length}`,
    `PARTICLES ${particles}`,
    `MULT x${s.multiplier}  UNSTABLE ${s.unstable}`,
  ];
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = DEBUG_COLOR;
  lines.forEach((l, i) => ctx.fillText(l, 12, SCANNER_H + 20 + i * 15));

  ctx.strokeStyle = DEBUG_COLOR;
  ctx.lineWidth = 1;
  const circle = (x: number, y: number, r: number) => {
    const sx = toScreenX(x, camX);
    if (sx < -50 || sx > VIEW_W + 50) return;
    ctx.beginPath();
    ctx.arc(sx, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  for (const e of s.enemies) circle(e.x, e.y, e.radius);
  for (const m of s.men) if (m.state !== 'dead' && m.state !== 'saved') circle(m.x, m.y, MAN_RADIUS);
  if (s.player.alive) circle(s.player.x, s.player.y, PLAYER_RADIUS * 0.8);
}
```

Edit `src/render/effects.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
        case 'extraLife':
          this.popup(s.player.x, s.player.y - 40, 'EXTRA LIFE', PALETTE.player);
          break;
        case 'planetCritical':
          this.addTrauma(0.5);
          this._flash = 0.6;
          this.flashColor = PALETTE.warn;
```

   with:

```ts
        case 'extraLife':
          this.popup(s.player.x, s.player.y - 40, 'EXTRA LIFE', PALETTE.player);
          break;
        case 'planetUnstable':
          this.addTrauma(0.5);
          this._flash = 0.6;
          this.flashColor = PALETTE.warn;
```

Edit `src/render/hud.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  ctx.clip();

  // Mini terrain
  ctx.strokeStyle = s.critical ? PALETTE.terrainCritical : PALETTE.terrain;
  ctx.beginPath();
  const step = 128;
  const offsets = scannerTerrainOffsets(step);
```

   with:

```ts
  ctx.clip();

  // Mini terrain
  ctx.strokeStyle = s.unstable ? PALETTE.terrainUnstable : PALETTE.terrain;
  ctx.beginPath();
  const step = 128;
  const offsets = scannerTerrainOffsets(step);
```

2. Replace:

```ts

function drawCenterMessages(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.textAlign = 'center';
  if (s.critical && Math.floor(s.time * 3) % 2 === 0) {
    ctx.fillStyle = PALETTE.warn;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('PLANET CRITICAL', VIEW_W / 2, SCANNER_H + 36);
  }
  if (s.phase === 'waveComplete') {
    ctx.fillStyle = PALETTE.text;
```

   with:

```ts

function drawCenterMessages(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.textAlign = 'center';
  if (s.unstable && Math.floor(s.time * 3) % 2 === 0) {
    ctx.fillStyle = PALETTE.warn;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('PLANET UNSTABLE', VIEW_W / 2, SCANNER_H + 36);
  }
  if (s.phase === 'waveComplete') {
    ctx.fillStyle = PALETTE.text;
```

Replace the whole content of `src/render/palette.ts` with:

```ts
import type { ExplosionSource } from '../game/events';

export const PALETTE = {
  player: '#22e6ff',
  man: '#4dff88',
  snatcher: '#ff3df2',
  nemesite: '#ff3b3b',
  trailer: '#ff9a1f',
  orb: '#a46bff',
  fragment: '#c99bff',
  hunter: '#ffe066',
  planter: '#ff4fd8',
  android: '#b8ff3a',
  spore: '#c56bff',
  blunderstorm: '#8fb8ff',
  nmeye: '#ff5fa0',
  antimatter: '#f0f0ff',
  base: '#19e3c3',
  laser: '#9ff6ff',
  shot: '#ff6a6a',
  terrain: '#3d7bff',
  terrainUnstable: '#ff3b5c',
  magma: '#ff7a1a',
  hotRock: '#fff3c4',
  lake: '#3ff0ff',
  acid: '#9dff3a',
  bolt: '#d8f4ff',
  hud: '#9ad8ff',
  text: '#e8f6ff',
  warn: '#ff4d6d',
} as const;

export function explosionColor(source: ExplosionSource): string {
  return PALETTE[source];
}
```

Edit `src/render/renderer.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
    const ctx = this.view.beginFrame();
    const shake = fx ? fx.shake() : { x: 0, y: 0 };

    this.bg.drawSky(ctx, s.critical);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.bg.drawStars(ctx, cam.x);
    this.bg.drawMountains(ctx, cam.x, s.critical);
    this.bg.drawTerrain(ctx, s.terrain, cam.x, s.critical);
    this.bg.drawLandscape(ctx, s.landscape, s.terrain, cam.x, s.time, s.critical);
    this.bg.drawBase(ctx, s.baseX, cam.x, s.time);

    this.drawTrails(ctx, s, cam.x);
```

   with:

```ts
    const ctx = this.view.beginFrame();
    const shake = fx ? fx.shake() : { x: 0, y: 0 };

    this.bg.drawSky(ctx, s.unstable);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.bg.drawStars(ctx, cam.x);
    this.bg.drawMountains(ctx, cam.x, s.unstable);
    this.bg.drawTerrain(ctx, s.terrain, cam.x, s.unstable);
    this.bg.drawLandscape(ctx, s.landscape, s.terrain, cam.x, s.time, s.unstable);
    this.bg.drawBase(ctx, s.baseX, cam.x, s.time);

    this.drawTrails(ctx, s, cam.x);
```

Edit `src/scenes/app.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
      this.fx.update(frameDt, s);
      updateCamera(this.camera, lerpWrapped(s.player.prevX, s.player.x, alpha), s.player.facing, frameDt);
    }
    this.music.setIntensity(s.critical ? 2 : s.wave >= 5 ? 1 : 0);
    this.renderer.render(s, this.camera, alpha, this.fx);
    this.drawScreens();
  }
```

   with:

```ts
      this.fx.update(frameDt, s);
      updateCamera(this.camera, lerpWrapped(s.player.prevX, s.player.x, alpha), s.player.facing, frameDt);
    }
    this.music.setIntensity(s.unstable ? 2 : s.wave >= 5 ? 1 : 0);
    this.renderer.render(s, this.camera, alpha, this.fx);
    this.drawScreens();
  }
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 304 tests pass, no type errors.

- [ ] **Step 5: Browser check**

`npm run dev`: men walk toward the base; one that reaches the pad disappears without scoring; carrying one in wave 1 scores 100. (Effects for self-rescue come in Task 13.)

- [ ] **Step 6: Commit**

```bash
git add -A src/audio/eventAudio.ts src/game/constants.ts src/game/events.ts src/game/state.ts src/game/systems/rescue.ts src/game/systems/volcanoes.ts src/game/systems/waves.ts src/game/update.ts src/render/background.ts src/render/debug.ts src/render/effects.ts src/render/hud.ts src/render/palette.ts src/render/renderer.ts src/scenes/app.ts tests/audio/eventAudio.test.ts tests/game/sim.test.ts tests/game/systems/rescue.test.ts tests/game/systems/volcanoes.test.ts tests/game/systems/waves.test.ts tests/game/update.test.ts
git commit -m "feat: men walk to the base and the planet goes unstable when all are lost"
```

---

### Task 10: Waves switch-over: original roster, invasions, shipments, survivors, wave-end rule

Wave spawning switches to the original roster. The Phase 1 kinds still exist in the code (deleted in Task 11) but are no longer spawned.

- `tuning.ts` (full rewrite): table for waves 1–10 of Planters/Spores/Blunderstorms (no Blunderstorms in waves 1–2), formula after 10 (capped 16/8/6), plus `effectiveWave` (1–99, then 95–99 repeating), `isInvasionWave` (`effectiveWave % 5 === 0`), `isShipmentWave` (`effectiveWave % 5 === 1` and > 1), `getInvasionTuning` (6 + wave/5 Trailers, 2 Spores).
- `startWave`: tuning uses the effective wave; shipments reset `survivors` to 8 (the +1 bomb on that wave stays until Task 12); invasions spawn no men (survivors wait) and emit `invasionWave`; otherwise `survivors` men are deployed (`menRemaining` is no longer read; the field is deleted in Task 11).
- `checkWaveClear`: the wave ends only when no enemy is alive AND no man is `walking`, `carried`, `chased` or `falling` (a carried man is no longer auto-saved). Non-invasion waves set `survivors = savedThisWave` (so after an unstable wave, where every man died, the next waves have 0 men until a shipment). Bonus = saved × min(500, 100 × wave) × multiplier (`waveBonusPerMan`).

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/systems/waves.ts`
- Modify: `src/game/tuning.ts`
- Test (modify): `tests/game/sim.test.ts`
- Test (modify): `tests/game/systems/waves.test.ts`
- Test (modify): `tests/game/tuning.test.ts`
- Test (modify): `tests/game/update.test.ts`

**Interfaces:**
- Consumes: `createEnemy` for `planter`/`spore`/`blunderstorm`/`trailer`/`nmeye` (Task 2), `spawnMen` (Task 9), `clearHazards` (Task 3), `s.survivors` (Task 2), `addScore`.
- Produces:
  - `src/game/tuning.ts`: `interface WaveTuning { planters: number; spores: number; storms: number; speedScale: number; fireInterval: number }`, `WAVE_TABLE`, `getWaveTuning(wave: number): WaveTuning`, `effectiveWave(wave: number): number`, `isInvasionWave(wave: number): boolean`, `isShipmentWave(wave: number): boolean`, `interface InvasionTuning { trailers: number; spores: number }`, `getInvasionTuning(wave: number): InvasionTuning`
  - `waves.ts`: `startWave`, `updateWaveTimers`, `checkWaveClear`, `updateWavePhase`, `newGame` (same signatures), new `waveBonusPerMan(wave: number): number`
  - Constants `WAVE_BONUS_CAP = 500`, `INVASION_EVERY = 5`, `INVASION_BASE_TRAILERS = 6`, `INVASION_SPORES = 2`, `LAST_WAVE = 99`, `CYCLE_START = 95`

- [ ] **Step 1: Write the failing tests**

Replace the whole content of `tests/game/sim.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { NO_ACTIONS, type Actions } from '../../src/core/input';
import { update } from '../../src/game/update';
import { newGame } from '../../src/game/systems/waves';
import { SIM_DT, MEN_PER_WAVE } from '../../src/game/constants';
import type { GameState } from '../../src/game/state';

/** Deterministic scripted pilot: sweeps back and forth, bobs, fires constantly, bombs and cloaks periodically. */
function scriptedActions(tick: number): Actions {
  const t = tick * SIM_DT;
  return {
    ...NO_ACTIONS,
    moveX: Math.sin(t * 0.4) > 0 ? 1 : -1,
    moveY: Math.sin(t * 1.3),
    fire: true,
    bomb: tick > 0 && tick % (120 * 10) === 0,
    cloak: t % 15 < 2,
  };
}

function simulate(seed: number, seconds: number, lives?: number): { s: GameState; nmeyes: number } {
  const s = newGame(seed);
  if (lives !== undefined) s.lives = lives;
  const ticks = Math.round(seconds / SIM_DT);
  let nmeyes = 0;
  for (let i = 0; i < ticks; i++) {
    update(s, scriptedActions(i), SIM_DT);
    for (const e of s.events) if (e.type === 'nmeyeSpawned') nmeyes++;
    s.events.length = 0;
  }
  return { s, nmeyes };
}

function allFinite(s: GameState): boolean {
  const nums: number[] = [s.score, s.player.x, s.player.y, s.player.vx, s.player.vy, s.time];
  for (const e of s.enemies) nums.push(e.x, e.y, e.vx, e.vy);
  for (const m of s.men) nums.push(m.x, m.y);
  for (const sh of s.shots) nums.push(sh.x, sh.y);
  for (const m of s.magma) nums.push(m.x, m.y);
  return nums.every(Number.isFinite);
}

describe('deterministic simulation', () => {
  it('runs 90 s of scripted play without NaNs or runaway entity counts', () => {
    const { s, nmeyes } = simulate(1234, 90, 99);
    expect(s.time).toBeCloseTo(90, 0);
    expect(nmeyes).toBeGreaterThanOrEqual(1);
    expect(allFinite(s)).toBe(true);
    expect(s.enemies.length).toBeLessThan(200);
    expect(s.shots.length).toBeLessThan(500);
    expect(s.magma.length + s.acid.length + s.eyeBombs.length).toBeLessThan(500);
    expect(s.wave).toBeGreaterThanOrEqual(1);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.lives).toBeGreaterThanOrEqual(0);
  });

  it('is fully deterministic for a given seed', () => {
    const a = simulate(777, 30).s;
    const b = simulate(777, 30).s;
    expect(b.score).toBe(a.score);
    expect(b.wave).toBe(a.wave);
    expect(b.lives).toBe(a.lives);
    expect(b.player.x).toBe(a.player.x);
    expect(b.enemies.length).toBe(a.enemies.length);
    expect(b.rng.state).toBe(a.rng.state);
  });
});

describe('wave progression', () => {
  it('reaches wave 6 with a fresh shipment of men even after the planet went unstable', () => {
    const s = newGame(42);
    s.lives = 99;
    let unstableSeen = false;
    const menAtStart: number[] = [];
    let lastWave = 0;
    for (let i = 0; i < 120 * 600 && s.wave < 6; i++) {
      if (s.wave !== lastWave) {
        menAtStart[s.wave] = s.men.length;
        lastWave = s.wave;
      }
      // Clear the enemies and resolve every man: wave 3 loses them all, the others are saved.
      s.enemies = [];
      for (const m of s.men) {
        if (m.state === 'saved' || m.state === 'dead') continue;
        m.state = s.wave === 3 ? 'dead' : 'saved';
        if (m.state === 'saved') s.savedThisWave++;
      }
      s.player.carryingId = null;
      update(s, NO_ACTIONS, SIM_DT);
      if (s.unstable) unstableSeen = true;
      s.events.length = 0;
    }
    expect(s.wave).toBe(6);
    expect(unstableSeen).toBe(true);
    expect(menAtStart[2]).toBe(MEN_PER_WAVE);
    expect(menAtStart[4]).toBe(0); // planet went unstable in wave 3
    expect(menAtStart[5]).toBe(0); // invasion wave
    expect(s.men).toHaveLength(MEN_PER_WAVE); // shipment
  });
});
```

Replace the whole content of `tests/game/systems/waves.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../src/game/state';
import {
  startWave, updateWaveTimers, checkWaveClear, updateWavePhase, newGame, waveBonusPerMan,
} from '../../../src/game/systems/waves';
import { getWaveTuning } from '../../../src/game/tuning';
import { registerKill } from '../../../src/game/systems/scoring';
import {
  MEN_PER_WAVE, NMEYE_DELAY, NMEYE_REPEAT, SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME,
  START_BOMBS, MAX_BOMBS,
} from '../../../src/game/constants';
import { shortestDx } from '../../../src/core/world';
import { addMan, addEnemy } from '../helpers';

const count = (s: GameState, k: string) => s.enemies.filter((e) => e.kind === k).length;

describe('startWave', () => {
  it('spawns the tuned Planters, Spores and Blunderstorms and deploys the survivors', () => {
    const s = createGameState(1);
    startWave(s, 3);
    const t = getWaveTuning(3);
    expect(count(s, 'planter')).toBe(t.planters);
    expect(count(s, 'spore')).toBe(t.spores);
    expect(count(s, 'blunderstorm')).toBe(t.storms);
    expect(s.enemies).toHaveLength(t.planters + t.spores + t.storms);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
    expect(s.wave).toBe(3);
    expect(s.speedScale).toBe(t.speedScale);
    expect(s.enemyFireInterval).toBe(t.fireInterval);
    expect(s.phase).toBe('playing');
    expect(s.events).toContainEqual({ type: 'waveStarted', wave: 3 });
  });

  it('waves 1 and 2 have no Blunderstorms', () => {
    const s = createGameState(1);
    startWave(s, 1);
    expect(count(s, 'blunderstorm')).toBe(0);
    startWave(s, 2);
    expect(count(s, 'blunderstorm')).toBe(0);
  });

  it('spawns enemies away from the player', () => {
    const s = createGameState(1);
    startWave(s, 9);
    for (const e of s.enemies) {
      expect(Math.abs(shortestDx(s.player.x, e.x))).toBeGreaterThanOrEqual(SPAWN_SAFE_DISTANCE - 1);
    }
  });

  it('resets per-wave state', () => {
    const s = createGameState(1);
    s.unstable = true;
    s.savedThisWave = 4;
    s.player.cloak = 0;
    s.shots.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
    startWave(s, 2);
    expect(s.unstable).toBe(false);
    expect(s.savedThisWave).toBe(0);
    expect(s.player.cloak).toBe(1);
    expect(s.shots).toHaveLength(0);
    expect(s.waveTime).toBe(0);
    expect(s.nextNmeyeAt).toBe(NMEYE_DELAY);
  });

  it('deploys only the survivors of the previous wave', () => {
    const s = createGameState(1);
    s.survivors = 3;
    startWave(s, 2);
    expect(s.men).toHaveLength(3);
  });

  it('a wave after the planet went unstable has no men', () => {
    const s = createGameState(1);
    s.survivors = 0;
    startWave(s, 3);
    expect(s.men).toHaveLength(0);
  });
});

describe('invasion waves', () => {
  it('every fifth wave is a Trailer invasion: 6 + wave/5 Trailers, 2 Spores, no men', () => {
    const s = createGameState(1);
    s.survivors = 5;
    startWave(s, 5);
    expect(count(s, 'trailer')).toBe(7);
    expect(count(s, 'spore')).toBe(2);
    expect(count(s, 'planter')).toBe(0);
    expect(s.men).toHaveLength(0);
    expect(s.events).toContainEqual({ type: 'invasionWave', wave: 5 });
  });

  it('survivors wait through an invasion and come back next wave', () => {
    const s = createGameState(1);
    s.survivors = 2;
    startWave(s, 10);
    s.enemies = [];
    checkWaveClear(s);
    expect(s.phase).toBe('waveComplete');
    expect(s.survivors).toBe(2);
    expect(s.lastWaveBonus).toBe(0);
  });
});

describe('shipments', () => {
  it('the wave after an invasion tops the men back up to 8 and gives a bomb', () => {
    const s = createGameState(1);
    s.survivors = 0;
    startWave(s, 6);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
    expect(s.survivors).toBe(MEN_PER_WAVE);
    expect(s.bombs).toBe(START_BOMBS + 1);
    s.bombs = MAX_BOMBS;
    startWave(s, 11);
    expect(s.bombs).toBe(MAX_BOMBS);
  });
});

describe('wave 95-99 cycle', () => {
  it('wave 100 plays as wave 95 (an invasion) but keeps its displayed number', () => {
    const s = createGameState(1);
    startWave(s, 100);
    expect(s.wave).toBe(100);
    expect(count(s, 'trailer')).toBe(6 + 19);
    expect(s.speedScale).toBe(getWaveTuning(95).speedScale);
  });

  it('wave 101 plays as wave 96, a shipment', () => {
    const s = createGameState(1);
    s.survivors = 0;
    startWave(s, 101);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
    expect(count(s, 'planter')).toBe(getWaveTuning(96).planters);
  });
});

describe('nmeye timer', () => {
  it('spawns an Nmeye 60 s into the wave and then every 20 s', () => {
    const s = createGameState(1);
    startWave(s, 1);
    expect(NMEYE_DELAY).toBe(60);
    expect(NMEYE_REPEAT).toBe(20);
    const nmeyes = () => count(s, 'nmeye');
    updateWaveTimers(s, NMEYE_DELAY - 0.01);
    expect(nmeyes()).toBe(0);
    updateWaveTimers(s, 0.02);
    expect(nmeyes()).toBe(1);
    expect(s.events.some((e) => e.type === 'nmeyeSpawned')).toBe(true);
    updateWaveTimers(s, NMEYE_REPEAT);
    expect(nmeyes()).toBe(2);
  });
});

describe('wave clear', () => {
  it('does nothing while enemies remain', () => {
    const s = createGameState(1);
    addEnemy(s, 'planter', 3000, 300);
    checkWaveClear(s);
    expect(s.phase).toBe('playing');
  });

  it('does nothing while any man is walking, carried, chased or falling', () => {
    for (const state of ['walking', 'carried', 'chased', 'falling'] as const) {
      const s = createGameState(1);
      s.wave = 2;
      addMan(s, 3000, state);
      addMan(s, 4000, 'saved');
      checkWaveClear(s);
      expect(s.phase).toBe('playing');
    }
  });

  it('ends once no enemies are left and every man is saved or dead', () => {
    const s = createGameState(1);
    s.wave = 2;
    addMan(s, 3000, 'saved');
    addMan(s, 4000, 'dead');
    checkWaveClear(s);
    expect(s.phase).toBe('waveComplete');
    expect(s.phaseTimer).toBe(WAVE_COMPLETE_TIME);
  });

  it('awards survivors x 100 x wave, and the survivors carry over to the next wave', () => {
    const s = createGameState(1);
    s.wave = 4;
    s.savedThisWave = 3;
    checkWaveClear(s);
    const bonus = 3 * 400;
    expect(s.score).toBe(bonus);
    expect(s.lastWaveBonus).toBe(bonus);
    expect(s.survivors).toBe(3);
    expect(s.events).toContainEqual({ type: 'waveCleared', wave: 4, bonus, saved: 3 });
  });

  it('caps the bonus at 500 per man and applies the combo multiplier', () => {
    expect(waveBonusPerMan(3)).toBe(300);
    expect(waveBonusPerMan(5)).toBe(500);
    expect(waveBonusPerMan(42)).toBe(500);
    const s = createGameState(1);
    s.wave = 7;
    s.savedThisWave = 2;
    registerKill(s, 0, 0, 0);
    registerKill(s, 0, 0, 0); // x2
    checkWaveClear(s);
    expect(s.lastWaveBonus).toBe(2 * 500 * 2);
  });

  it('starts the next wave after WAVE_COMPLETE_TIME', () => {
    const s = createGameState(1);
    s.wave = 1;
    checkWaveClear(s);
    updateWavePhase(s, WAVE_COMPLETE_TIME - 0.1);
    expect(s.phase).toBe('waveComplete');
    updateWavePhase(s, 0.2);
    expect(s.phase).toBe('playing');
    expect(s.wave).toBe(2);
  });
});

describe('hazards on wave start', () => {
  it('startWave clears magma, acid, bolts and nmeye bombs', () => {
    const s = createGameState(1);
    s.magma.push({ x: 0, y: 0, vx: 0, vy: 0, r: 5, hot: false });
    s.acid.push({ x: 0, y: 0, vy: 1 });
    s.bolts.push({ x: 0, top: 0, bottom: 1, life: 1 });
    s.eyeBombs.push({ x: 0, y: 0, vy: 1 });
    startWave(s, 2);
    expect(s.magma.length + s.acid.length + s.bolts.length + s.eyeBombs.length).toBe(0);
  });
});

describe('newGame', () => {
  it('creates a state already in wave 1', () => {
    const s = newGame(99);
    expect(s.wave).toBe(1);
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
  });
});
```

Replace the whole content of `tests/game/tuning.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import {
  getWaveTuning, WAVE_TABLE, effectiveWave, isInvasionWave, isShipmentWave, getInvasionTuning,
} from '../../src/game/tuning';

describe('getWaveTuning', () => {
  it('uses the explicit table for waves 1-10', () => {
    expect(WAVE_TABLE).toHaveLength(10);
    expect(getWaveTuning(1)).toEqual(WAVE_TABLE[0]);
    expect(getWaveTuning(10)).toEqual(WAVE_TABLE[9]);
  });

  it('waves 1-2 have no Blunderstorms; they appear from wave 3', () => {
    expect(getWaveTuning(1).storms).toBe(0);
    expect(getWaveTuning(2).storms).toBe(0);
    expect(getWaveTuning(3).storms).toBeGreaterThan(0);
  });

  it('wave 1 is gentle', () => {
    const t = getWaveTuning(1);
    expect(t.planters).toBeGreaterThan(0);
    expect(t.speedScale).toBe(1);
  });

  it('difficulty never decreases from wave to wave', () => {
    for (let w = 1; w < 40; w++) {
      const a = getWaveTuning(w);
      const b = getWaveTuning(w + 1);
      expect(b.planters + b.spores + b.storms).toBeGreaterThanOrEqual(a.planters + a.spores + a.storms);
      expect(b.speedScale).toBeGreaterThanOrEqual(a.speedScale);
      expect(b.fireInterval).toBeLessThanOrEqual(a.fireInterval);
    }
  });

  it('caps counts, speed and fire rate in late waves', () => {
    const t = getWaveTuning(500);
    expect(t.planters).toBeLessThanOrEqual(16);
    expect(t.spores).toBeLessThanOrEqual(8);
    expect(t.storms).toBeLessThanOrEqual(6);
    expect(t.speedScale).toBeLessThanOrEqual(2);
    expect(t.fireInterval).toBeGreaterThanOrEqual(0.9);
  });

  it('treats wave < 1 as wave 1', () => {
    expect(getWaveTuning(0)).toEqual(WAVE_TABLE[0]);
  });
});

describe('wave numbering', () => {
  it('plays waves 1-99 as numbered', () => {
    expect(effectiveWave(1)).toBe(1);
    expect(effectiveWave(57)).toBe(57);
    expect(effectiveWave(99)).toBe(99);
  });

  it('cycles 95-99 after wave 99', () => {
    expect([100, 101, 102, 103, 104, 105, 106].map(effectiveWave)).toEqual([95, 96, 97, 98, 99, 95, 96]);
  });

  it('every fifth wave is a Trailer invasion', () => {
    expect([1, 4, 5, 6, 10, 15, 95, 100].map(isInvasionWave)).toEqual([false, false, true, false, true, true, true, true]);
  });

  it('the wave after an invasion is a shipment, from wave 6', () => {
    expect([1, 6, 7, 11, 96, 101].map(isShipmentWave)).toEqual([false, true, false, true, true, true]);
  });

  it('an invasion has 6 + wave/5 Trailers and 2 Spores', () => {
    expect(getInvasionTuning(5)).toEqual({ trailers: 7, spores: 2 });
    expect(getInvasionTuning(10)).toEqual({ trailers: 8, spores: 2 });
    expect(getInvasionTuning(100)).toEqual({ trailers: 25, spores: 2 });
  });
});
```

Edit `tests/game/update.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  it('a cleared wave advances to the next wave', () => {
    const s = newGame(5);
    s.enemies = [];
    update(s, NO_ACTIONS, SIM_DT);
    expect(s.phase).toBe('waveComplete');
    for (let t = 0; t < 4; t += SIM_DT) update(s, NO_ACTIONS, SIM_DT);
```

   with:

```ts
  it('a cleared wave advances to the next wave', () => {
    const s = newGame(5);
    s.enemies = [];
    for (const m of s.men) m.state = 'saved';
    update(s, NO_ACTIONS, SIM_DT);
    expect(s.phase).toBe('waveComplete');
    for (let t = 0; t < 4; t += SIM_DT) update(s, NO_ACTIONS, SIM_DT);
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/game/sim.test.ts tests/game/systems/waves.test.ts tests/game/tuning.test.ts tests/game/update.test.ts`
Expected: FAIL: `tuning.test.ts` (no `effectiveWave` export, `storms` undefined), `waves.test.ts` (old roster spawned, no invasion, `waveBonusPerMan` missing), and `sim.test.ts` wave progression. (`update.test.ts` "a cleared wave advances" is edited to save the men first; it keeps passing.)

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const BASE_WIDTH = 160;
/** Player must be within this height above the pad surface to deliver a man. */
export const BASE_DELIVERY_HEIGHT = 70;
export const WAVE_BONUS_PER_MAN = 100;

// Scoring
export const COMBO_WINDOW = 1.5;
```

   with:

```ts
export const BASE_WIDTH = 160;
/** Player must be within this height above the pad surface to deliver a man. */
export const BASE_DELIVERY_HEIGHT = 70;
/** End-of-wave bonus per survivor saved this wave: 100 x wave, capped at 500. */
export const WAVE_BONUS_PER_MAN = 100;
export const WAVE_BONUS_CAP = 500;

// Scoring
export const COMBO_WINDOW = 1.5;
```

2. Replace:

```ts

// Waves
export const MILESTONE_EVERY = 5;
export const WAVE_COMPLETE_TIME = 3;
/** Seconds into a wave before any snatcher may target a man. */
export const SNATCH_GRACE = 8;
```

   with:

```ts

// Waves
export const MILESTONE_EVERY = 5;
/** Every 5th wave is a Trailer invasion; the wave after each one (from wave 6) is a shipment. */
export const INVASION_EVERY = 5;
export const INVASION_BASE_TRAILERS = 6;
export const INVASION_SPORES = 2;
/** Waves above this replay the last cycle (100 plays as 95, 101 as 96, ...). */
export const LAST_WAVE = 99;
export const CYCLE_START = 95;
export const WAVE_COMPLETE_TIME = 3;
/** Seconds into a wave before any snatcher may target a man. */
export const SNATCH_GRACE = 8;
```

Replace the whole content of `src/game/systems/waves.ts` with:

```ts
import { VIEW_W, WORLD_W, wrapX } from '../../core/world';
import { range, chance } from '../../core/rng';
import { createGameState, type GameState, type EnemyKind } from '../state';
import { emit } from '../events';
import {
  getWaveTuning, getInvasionTuning, effectiveWave, isInvasionWave, isShipmentWave,
} from '../tuning';
import { createEnemy } from '../entities/enemies';
import { spawnMen } from './rescue';
import { addScore } from './scoring';
import { clearHazards } from './hazards';
import {
  CEILING_Y, NMEYE_DELAY, NMEYE_REPEAT, MEN_PER_WAVE, MAX_BOMBS,
  SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME, WAVE_BONUS_PER_MAN, WAVE_BONUS_CAP,
} from '../constants';

const SPAWN_MIN_Y = CEILING_Y + 40;
const SPAWN_MAX_Y = 420;

/** Men in these states keep the wave going. */
const UNRESOLVED = new Set(['walking', 'carried', 'chased', 'falling']);

function spawnX(s: GameState): number {
  return wrapX(s.player.x + range(s.rng, SPAWN_SAFE_DISTANCE, WORLD_W - SPAWN_SAFE_DISTANCE));
}

export function startWave(s: GameState, wave: number): void {
  s.wave = wave;
  s.waveTime = 0;
  s.nextNmeyeAt = NMEYE_DELAY;
  s.savedThisWave = 0;
  s.unstable = false;
  s.phase = 'playing';
  s.phaseTimer = 0;

  if (isShipmentWave(wave)) {
    s.survivors = MEN_PER_WAVE;
    s.bombs = Math.min(MAX_BOMBS, s.bombs + 1);
  }

  const t = getWaveTuning(effectiveWave(wave));
  s.speedScale = t.speedScale;
  s.enemyFireInterval = t.fireInterval;

  s.enemies = [];
  s.shots = [];
  clearHazards(s);
  s.lasers = [];
  s.men = [];
  s.player.carryingId = null;
  s.player.cloak = 1;

  const invasion = isInvasionWave(wave);
  // Invasion waves have no men: the survivors wait for the next wave.
  if (!invasion) spawnMen(s, s.survivors);

  let groups: Array<[EnemyKind, number]>;
  if (invasion) {
    const inv = getInvasionTuning(wave);
    groups = [['trailer', inv.trailers], ['spore', inv.spores]];
  } else {
    groups = [['planter', t.planters], ['spore', t.spores], ['blunderstorm', t.storms]];
  }
  for (const [kind, n] of groups) {
    for (let i = 0; i < n; i++) {
      s.enemies.push(createEnemy(s, kind, spawnX(s), range(s.rng, SPAWN_MIN_Y, SPAWN_MAX_Y)));
    }
  }
  emit(s, { type: 'waveStarted', wave });
  if (invasion) emit(s, { type: 'invasionWave', wave });
}

export function updateWaveTimers(s: GameState, dt: number): void {
  s.waveTime += dt;
  while (s.waveTime >= s.nextNmeyeAt) {
    const side = chance(s.rng, 0.5) ? 1 : -1;
    const x = wrapX(s.player.x + side * VIEW_W * 0.7);
    const y = range(s.rng, SPAWN_MIN_Y, 400);
    s.enemies.push(createEnemy(s, 'nmeye', x, y));
    s.nextNmeyeAt += NMEYE_REPEAT;
    emit(s, { type: 'nmeyeSpawned', x, y });
  }
}

/** End-of-wave bonus per survivor saved this wave: 100 x wave, capped at 500. */
export function waveBonusPerMan(wave: number): number {
  return Math.min(WAVE_BONUS_CAP, WAVE_BONUS_PER_MAN * effectiveWave(wave));
}

/** The wave ends when no enemy is alive and every man is saved or dead. */
export function checkWaveClear(s: GameState): void {
  if (s.phase !== 'playing') return;
  if (s.enemies.some((e) => !e.dead)) return;
  if (s.men.some((m) => UNRESOLVED.has(m.state))) return;

  // Men saved this wave are re-deployed next wave. Invasion waves have none, so survivors keep waiting.
  if (!isInvasionWave(s.wave)) s.survivors = s.savedThisWave;

  const bonus = s.savedThisWave * waveBonusPerMan(s.wave) * s.multiplier;
  addScore(s, bonus);
  s.lastWaveBonus = bonus;
  s.phase = 'waveComplete';
  s.phaseTimer = WAVE_COMPLETE_TIME;
  emit(s, { type: 'waveCleared', wave: s.wave, bonus, saved: s.savedThisWave });
}

export function updateWavePhase(s: GameState, dt: number): void {
  if (s.phase !== 'waveComplete') return;
  s.phaseTimer -= dt;
  if (s.phaseTimer <= 0) startWave(s, s.wave + 1);
}

export function newGame(seed: number): GameState {
  const s = createGameState(seed);
  startWave(s, 1);
  return s;
}
```

Replace the whole content of `src/game/tuning.ts` with:

```ts
import {
  INVASION_EVERY, INVASION_BASE_TRAILERS, INVASION_SPORES, LAST_WAVE, CYCLE_START,
} from './constants';

export interface WaveTuning {
  planters: number;
  spores: number;
  storms: number;
  speedScale: number;
  /** Base seconds between shots for a shooting enemy (scaled per enemy kind). */
  fireInterval: number;
}

const t = (planters: number, spores: number, storms: number, speedScale: number, fireInterval: number): WaveTuning =>
  ({ planters, spores, storms, speedScale, fireInterval });

/** Waves 1-10. Blunderstorms appear from wave 3. Invasion waves (5, 10) override the enemy counts. */
export const WAVE_TABLE: readonly WaveTuning[] = [
  t(5, 1, 0, 1.0, 4.0),
  t(6, 1, 0, 1.05, 3.6),
  t(6, 2, 1, 1.1, 3.3),
  t(7, 2, 1, 1.15, 3.0),
  t(7, 2, 2, 1.2, 2.8),
  t(8, 3, 2, 1.25, 2.6),
  t(8, 3, 2, 1.3, 2.4),
  t(9, 3, 3, 1.35, 2.2),
  t(9, 4, 3, 1.4, 2.0),
  t(10, 4, 3, 1.45, 1.8),
];

export function getWaveTuning(wave: number): WaveTuning {
  const w = Math.max(1, Math.floor(wave));
  if (w <= WAVE_TABLE.length) return WAVE_TABLE[w - 1];
  const last = WAVE_TABLE[WAVE_TABLE.length - 1];
  const extra = w - WAVE_TABLE.length;
  return {
    planters: Math.min(16, last.planters + Math.floor(extra / 2)),
    spores: Math.min(8, last.spores + Math.floor(extra / 4)),
    storms: Math.min(6, last.storms + Math.floor(extra / 3)),
    speedScale: Math.min(2, last.speedScale + extra * 0.03),
    fireInterval: Math.max(0.9, last.fireInterval - extra * 0.05),
  };
}

/** The wave that is actually played: 1-99 as numbered, then 95-99 repeating. */
export function effectiveWave(wave: number): number {
  const w = Math.max(1, Math.floor(wave));
  if (w <= LAST_WAVE) return w;
  const cycle = LAST_WAVE - CYCLE_START + 1;
  return CYCLE_START + ((w - LAST_WAVE - 1) % cycle);
}

export function isInvasionWave(wave: number): boolean {
  return effectiveWave(wave) % INVASION_EVERY === 0;
}

export function isShipmentWave(wave: number): boolean {
  const w = effectiveWave(wave);
  return w > 1 && w % INVASION_EVERY === 1;
}

export interface InvasionTuning {
  trailers: number;
  spores: number;
}

/** A Trailer invasion: 6 + wave/5 Trailers plus 2 Spores. */
export function getInvasionTuning(wave: number): InvasionTuning {
  return { trailers: INVASION_BASE_TRAILERS + Math.floor(effectiveWave(wave) / INVASION_EVERY), spores: INVASION_SPORES };
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 318 tests pass, no type errors.

- [ ] **Step 5: Browser check**

`npm run dev`: wave 1 has saucer Planters lowering Androids onto men (men show "!"), purple Spores drift; wave 3 adds Blunderstorm clouds near the top dropping green acid and bolts; wave 5 is all Trailers + 2 Spores with no men; a wave does not end while a man is still walking or carried.

- [ ] **Step 6: Commit**

```bash
git add -A src/game/constants.ts src/game/systems/waves.ts src/game/tuning.ts tests/game/sim.test.ts tests/game/systems/waves.test.ts tests/game/tuning.test.ts tests/game/update.test.ts
git commit -m "feat: switch waves to the original roster with invasions, shipments and survivors"
```

---

### Task 11: Delete the Phase 1 enemies (Snatcher, Orb/fragment, Hunter, trails)

Remove everything the original roster replaced. Nothing spawns these any more after Task 10.

- Deleted: kinds `snatcher`, `orb`, `fragment`, `hunter`; `TrailSeg`/`s.trails`/`updateTrails`; `ManState 'snatched'` (and `updateSnatched`); events `manSnatched`, `hunterSpawned`; Enemy fields `carryingId`, `trailTimer`, `aggressive`; `makeAggressive`, `AGGRESSIVE_SPEED_MULT`, `AGGRESSIVE_FIRE_MULT`; `GameState.menRemaining`; constants `SNATCH_CARRY_OFFSET`, `SNATCH_GRACE`, `TRAIL_LIFE`, `TRAIL_INTERVAL`, `TRAIL_RADIUS`, `MILESTONE_EVERY`; the snatcher/orb/hunter code in `ai/index.ts` and `combat.ts`; their sprites, palette entries, effects and audio cases.
- Renamed: `HITSTOP_HUNTER` → `HITSTOP_NMEYE`; the yellow `PALETTE.hunter` (used by HUD, screens and popups) → `PALETTE.gold`. A killed Spore is now a big explosion.
- Tests that used the old kinds switch to `nemesite`/`spore`/`planter`/`android`; tests of deleted behaviour are removed. The demo pilot needs no change.

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/state.ts`
- Modify: `src/game/events.ts`
- Modify: `src/game/entities/enemies.ts`
- Modify: `src/game/systems/ai/index.ts`
- Modify: `src/game/systems/combat.ts`
- Modify: `src/game/systems/rescue.ts`
- Modify: `src/game/update.ts`
- Modify: `src/audio/eventAudio.ts`
- Modify: `src/render/debug.ts`
- Modify: `src/render/effects.ts`
- Modify: `src/render/hud.ts`
- Modify: `src/render/palette.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/render/sprites.ts`
- Modify: `src/scenes/screens.ts`
- Test (modify): `tests/audio/eventAudio.test.ts`
- Test (modify): `tests/game/entities/enemies.test.ts`
- Test (modify): `tests/game/state.test.ts`
- Test (modify): `tests/game/systems/ai/index.test.ts`
- Test (modify): `tests/game/systems/ai/spawners.test.ts`
- Test (modify): `tests/game/systems/combat.test.ts`
- Test (modify): `tests/game/systems/powerups.test.ts`
- Test (modify): `tests/game/systems/rescue.test.ts`
- Test (modify): `tests/game/update.test.ts`
- Test (modify): `tests/render/effects.test.ts`
- Test (modify): `tests/scenes/demo.test.ts`

**Interfaces:**
- Consumes: Everything from Tasks 1–10.
- Produces:
  - `EnemyKind = 'planter' | 'android' | 'nemesite' | 'spore' | 'trailer' | 'blunderstorm' | 'nmeye' | 'antimatter'`
  - `ManState = 'walking' | 'carried' | 'chased' | 'falling' | 'saved' | 'dead'`
  - `ai/index.ts` exports only `updateEnemies`, `updateShots`
  - `fireInterval(s, e)` without the aggressive factor; `convertEnemy` without `carryingId`
  - Constant `HITSTOP_NMEYE = 0.04`; `PALETTE.gold = '#ffe066'`

- [ ] **Step 1: Write the failing tests**

Edit `tests/audio/eventAudio.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
    const { sfx, calls } = fakeSfx();
    const play = createEventAudio(sfx, () => 0);
    const events: GameEvent[] = [
      { type: 'explosion', x: 0, y: 0, source: 'orb', big: true },
      { type: 'manPickedUp', x: 0, y: 0 },
      { type: 'manCaught', x: 0, y: 0 },
      { type: 'manRescued', x: 0, y: 0 },
```

   with:

```ts
    const { sfx, calls } = fakeSfx();
    const play = createEventAudio(sfx, () => 0);
    const events: GameEvent[] = [
      { type: 'explosion', x: 0, y: 0, source: 'spore', big: true },
      { type: 'manPickedUp', x: 0, y: 0 },
      { type: 'manCaught', x: 0, y: 0 },
      { type: 'manRescued', x: 0, y: 0 },
```

2. Replace:

```ts
      { type: 'cloakOn' },
      { type: 'cloakOff' },
      { type: 'waveCleared', wave: 1, bonus: 0, saved: 0 },
      { type: 'hunterSpawned', x: 0, y: 0 },
    ];
    play(events);
    expect(calls).toEqual([
      'explosion:true', 'pickup', 'caught', 'rescue', 'manLost', 'bomb', 'death',
      'extraLife', 'klaxon', 'cloak:true', 'cloak:false', 'waveClear', 'hunter',
    ]);
  });
```

   with:

```ts
      { type: 'cloakOn' },
      { type: 'cloakOff' },
      { type: 'waveCleared', wave: 1, bonus: 0, saved: 0 },
    ];
    play(events);
    expect(calls).toEqual([
      'explosion:true', 'pickup', 'caught', 'rescue', 'manLost', 'bomb', 'death',
      'extraLife', 'klaxon', 'cloak:true', 'cloak:false', 'waveClear',
    ]);
  });
```

Edit `tests/game/entities/enemies.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import {
  ENEMY_STATS, createEnemy, fireInterval, convertEnemy, makeAggressive, AGGRESSIVE_SPEED_MULT,
} from '../../../src/game/entities/enemies';
import {
  PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX, STORM_BAND_TOP, STORM_BAND_BOTTOM, NMEYE_BOMB_INTERVAL, ANTIMATTER_ORBIT_RADIUS,
```

   with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import {
  ENEMY_STATS, createEnemy, fireInterval, convertEnemy,
} from '../../../src/game/entities/enemies';
import {
  PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX, STORM_BAND_TOP, STORM_BAND_BOTTOM, NMEYE_BOMB_INTERVAL, ANTIMATTER_ORBIT_RADIUS,
```

2. Replace:

```ts
    expect(s.enemies).toHaveLength(0);
  });

  it('orbs and fragments never fire', () => {
    const s = createGameState(1);
    expect(createEnemy(s, 'orb', 0, 200).fireTimer).toBe(Infinity);
    expect(fireInterval(s, createEnemy(s, 'fragment', 0, 200))).toBe(Infinity);
  });

  it('orbs and trailers start moving', () => {
    const s = createGameState(1);
    const orb = createEnemy(s, 'orb', 0, 200);
    expect(Math.hypot(orb.vx, orb.vy)).toBeGreaterThan(0);
    expect(Math.abs(createEnemy(s, 'trailer', 0, 200).vx)).toBeGreaterThan(0);
  });

  it('convertEnemy changes kind and stats and clears snatcher state', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'snatcher', 0, 200);
    e.carryingId = 5;
    e.targetId = 6;
    convertEnemy(s, e, 'nemesite');
    expect(e.kind).toBe('nemesite');
    expect(e.radius).toBe(ENEMY_STATS.nemesite.radius);
    expect(e.carryingId).toBeNull();
    expect(e.targetId).toBeNull();
  });

  it('makeAggressive turns non-hunters into fast nemesites', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'orb', 0, 200);
    makeAggressive(s, e);
    expect(e.kind).toBe('nemesite');
    expect(e.aggressive).toBe(true);
    expect(e.speed).toBeCloseTo(ENEMY_STATS.nemesite.speed * AGGRESSIVE_SPEED_MULT);
    const h = createEnemy(s, 'hunter', 0, 200);
    makeAggressive(s, h);
    expect(h.kind).toBe('hunter');
    expect(h.speed).toBeCloseTo(ENEMY_STATS.hunter.speed * AGGRESSIVE_SPEED_MULT);
  });
});
```

   with:

```ts
    expect(s.enemies).toHaveLength(0);
  });

  it('spores and androids never fire', () => {
    const s = createGameState(1);
    expect(createEnemy(s, 'spore', 0, 200).fireTimer).toBe(Infinity);
    expect(fireInterval(s, createEnemy(s, 'android', 0, 200))).toBe(Infinity);
  });

  it('spores and trailers start moving', () => {
    const s = createGameState(1);
    const spore = createEnemy(s, 'spore', 0, 200);
    expect(Math.hypot(spore.vx, spore.vy)).toBeGreaterThan(0);
    expect(Math.abs(createEnemy(s, 'trailer', 0, 200).vx)).toBeGreaterThan(0);
  });

  it('convertEnemy changes kind and stats and clears the target', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'android', 0, 200);
    e.targetId = 6;
    convertEnemy(s, e, 'antimatter');
    expect(e.kind).toBe('antimatter');
    expect(e.radius).toBe(ENEMY_STATS.antimatter.radius);
    expect(e.targetId).toBeNull();
  });

  it('only the eight original kinds exist', () => {
    expect(Object.keys(ENEMY_STATS).sort()).toEqual(
      ['android', 'antimatter', 'blunderstorm', 'nemesite', 'nmeye', 'planter', 'spore', 'trailer'],
    );
  });
});
```

Edit `tests/game/state.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
    expect(s.nextExtraLife).toBe(EXTRA_LIFE_EVERY);
    expect(s.score).toBe(0);
    expect(s.multiplier).toBe(1);
    expect(s.menRemaining).toBe(MEN_PER_WAVE);
    expect(s.phase).toBe('playing');
    expect(s.enemies).toEqual([]);
    expect(s.men).toEqual([]);
```

   with:

```ts
    expect(s.nextExtraLife).toBe(EXTRA_LIFE_EVERY);
    expect(s.score).toBe(0);
    expect(s.multiplier).toBe(1);
    expect(s.phase).toBe('playing');
    expect(s.enemies).toEqual([]);
    expect(s.men).toEqual([]);
```

Replace the whole content of `tests/game/systems/ai/index.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../../src/game/state';
import { updateEnemies, updateShots } from '../../../../src/game/systems/ai';
import { SIM_DT, CEILING_Y } from '../../../../src/game/constants';
import { WORLD_W } from '../../../../src/core/world';
import { addEnemy } from '../../helpers';

function tick(s: ReturnType<typeof createGameState>, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

describe('homing enemies', () => {
  it('nemesite homes toward the player across the seam', () => {
    const s = createGameState(1);
    s.player.x = 50;
    s.player.y = 300;
    const e = addEnemy(s, 'nemesite', WORLD_W - 200, 300);
    e.fireTimer = Infinity;
    tick(s, 1);
    expect(e.vx).toBeGreaterThan(0);
  });

  it('ignores a cloaked player', () => {
    const s = createGameState(1);
    s.player.cloakActive = true;
    const e = addEnemy(s, 'nemesite', s.player.x + 200, s.player.y);
    e.fireTimer = 0.001;
    tick(s, 0.1);
    expect(s.shots).toHaveLength(0);
  });
});

describe('enemy fire', () => {
  it('fires an aimed shot when the timer elapses and the player is in range', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nemesite', s.player.x + 300, s.player.y);
    e.fireTimer = 0.001;
    updateEnemies(s, SIM_DT);
    expect(s.shots).toHaveLength(1);
    expect(s.shots[0].vx).toBeLessThan(0);
    expect(s.events.some((ev) => ev.type === 'enemyShot')).toBe(true);
    expect(e.fireTimer).toBeGreaterThan(0);
  });

  it('does not fire at a player out of range', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nemesite', s.player.x + 3000, s.player.y);
    e.fireTimer = 0.001;
    updateEnemies(s, SIM_DT);
    expect(s.shots).toHaveLength(0);
  });
});

describe('integration', () => {
  it('a spore bounces off the ceiling', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'spore', 3000, CEILING_Y + 1);
    e.vy = -200;
    tick(s, 0.1);
    expect(e.vy).toBeGreaterThan(0);
  });

  it('skips dead enemies', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'spore', 3000, 300);
    e.dead = true;
    tick(s, 0.5);
    expect(e.x).toBe(3000);
  });
});

describe('updateShots', () => {
  it('moves shots and removes expired ones', () => {
    const s = createGameState(1);
    s.shots.push({ x: 1000, y: 300, vx: 100, vy: 0, life: 0.05 });
    updateShots(s, 0.01);
    expect(s.shots[0].x).toBeCloseTo(1001);
    updateShots(s, 0.1);
    expect(s.shots).toHaveLength(0);
  });

  it('removes shots that hit the ground', () => {
    const s = createGameState(1);
    s.shots.push({ x: 1000, y: 700, vx: 0, vy: 100, life: 2 });
    updateShots(s, 0.01);
    expect(s.shots).toHaveLength(0);
  });
});
```

Edit `tests/game/systems/ai/spawners.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
    expect(e.vx).toBeLessThan(0);
  });

  it('a non-homer weaves along its home line without leaving a trail', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 3000, 300);
    e.homer = false;
```

   with:

```ts
    expect(e.vx).toBeLessThan(0);
  });

  it('a non-homer weaves along its home line', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 3000, 300);
    e.homer = false;
```

2. Replace:

```ts
    }
    expect(maxY - minY).toBeGreaterThan(100);
    expect(Math.abs(e.vx)).toBeCloseTo(e.speed);
    expect(s.trails).toHaveLength(0);
  });
});
```

   with:

```ts
    }
    expect(maxY - minY).toBeGreaterThan(100);
    expect(Math.abs(e.vx)).toBeCloseTo(e.speed);
  });
});
```

Replace the whole content of `tests/game/systems/combat.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import {
  killEnemy, resolveLaserHits, killPlayer, resolvePlayerHits, pruneDead,
} from '../../../src/game/systems/combat';
import { ENEMY_STATS } from '../../../src/game/entities/enemies';
import { START_LIVES, HITSTOP_MULTI, HITSTOP_NMEYE, RESPAWN_DELAY } from '../../../src/game/constants';
import { addMan, addEnemy } from '../helpers';

describe('laser hits', () => {
  it('a laser kills an enemy, scores and explodes', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nemesite', 2000, 300);
    s.lasers.push({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 });
    resolveLaserHits(s);
    expect(e.dead).toBe(true);
    expect(s.lasers[0].life).toBe(0);
    expect(s.score).toBe(ENEMY_STATS.nemesite.points);
    expect(s.events).toContainEqual({ type: 'explosion', x: 2000, y: 300, source: 'nemesite', big: false });
    pruneDead(s);
    expect(s.enemies).toHaveLength(0);
    expect(s.lasers).toHaveLength(0);
  });

  it('one laser only kills one enemy', () => {
    const s = createGameState(1);
    addEnemy(s, 'nemesite', 2000, 300);
    addEnemy(s, 'nemesite', 2005, 300);
    s.lasers.push({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 });
    resolveLaserHits(s);
    expect(s.enemies.filter((e) => e.dead)).toHaveLength(1);
  });

  it('two kills in one tick trigger hit-stop', () => {
    const s = createGameState(1);
    addEnemy(s, 'nemesite', 2000, 300);
    addEnemy(s, 'nemesite', 3000, 300);
    s.lasers.push({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 });
    s.lasers.push({ prevX: 2990, x: 3010, y: 300, vx: 2200, life: 0.3 });
    resolveLaserHits(s);
    expect(s.hitStop).toBe(HITSTOP_MULTI);
  });
});

describe('killEnemy', () => {
  it('is idempotent', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nemesite', 2000, 300);
    killEnemy(s, e);
    killEnemy(s, e);
    expect(s.score).toBe(ENEMY_STATS.nemesite.points);
  });
});

describe('player hits', () => {
  it('an enemy shot kills the player, costs a life and drops a carried man', () => {
    const s = createGameState(1);
    const m = addMan(s, s.player.x, 'carried');
    s.player.carryingId = m.id;
    m.y = s.player.y + 200; // keep the man out of the shot's way
    s.shots.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, life: 1 });
    resolvePlayerHits(s);
    expect(s.player.alive).toBe(false);
    expect(s.player.respawnTimer).toBe(RESPAWN_DELAY);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(m.state).toBe('falling');
    expect(s.player.carryingId).toBeNull();
    expect(s.events.some((e) => e.type === 'playerDied')).toBe(true);
  });

  it('touching an enemy kills the player', () => {
    const s = createGameState(1);
    addEnemy(s, 'nemesite', s.player.x + 5, s.player.y);
    resolvePlayerHits(s);
    expect(s.player.alive).toBe(false);
  });

  it('cloak and invulnerability protect the player', () => {
    const s = createGameState(1);
    s.shots.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, life: 1 });
    s.player.cloakActive = true;
    resolvePlayerHits(s);
    expect(s.player.alive).toBe(true);
    s.player.cloakActive = false;
    s.player.invuln = 1;
    resolvePlayerHits(s);
    expect(s.player.alive).toBe(true);
  });

  it('an enemy shot can kill the carried man', () => {
    const s = createGameState(1);
    const m = addMan(s, s.player.x, 'carried');
    s.player.carryingId = m.id;
    m.y = s.player.y + 26;
    s.shots.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 1 });
    resolvePlayerHits(s);
    expect(m.state).toBe('dead');
    expect(s.player.carryingId).toBeNull();
    expect(s.player.alive).toBe(true);
  });

  it('losing the last life ends the game', () => {
    const s = createGameState(1);
    s.lives = 1;
    killPlayer(s);
    expect(s.lives).toBe(0);
    expect(s.phase).toBe('gameOver');
    expect(s.events.some((e) => e.type === 'gameOver')).toBe(true);
  });
});

describe('planter and android kills', () => {
  function lowering(s: ReturnType<typeof createGameState>) {
    const m = addMan(s, 3000, 'chased');
    const p = addEnemy(s, 'planter', 3000, 300);
    const a = addEnemy(s, 'android', 3000, 360);
    p.linkedId = a.id;
    p.tetherLen = 60;
    a.linkedId = p.id;
    a.targetId = m.id;
    m.holderId = a.id;
    return { m, p, a };
  }

  it('killing a Planter while it lowers drops its Android, which is then worth 500', () => {
    const s = createGameState(1);
    const { p, a } = lowering(s);
    killEnemy(s, p);
    expect(a.falling).toBe(true);
    expect(a.linkedId).toBeNull();
    expect(s.score).toBe(ENEMY_STATS.planter.points);
    killEnemy(s, a);
    expect(s.score).toBe(ENEMY_STATS.planter.points + 500 * 2); // second kill in the combo window is x2
  });

  it('a lowering or walking Android is worth 50', () => {
    const s = createGameState(1);
    const { a } = lowering(s);
    killEnemy(s, a);
    expect(s.score).toBe(50);
  });

  it('killing a lowering Android turns its Planter into a Nemesite and frees the man', () => {
    const s = createGameState(1);
    const { m, p, a } = lowering(s);
    killEnemy(s, a);
    expect(p.kind).toBe('nemesite');
    expect(p.linkedId).toBeNull();
    expect(m.state).toBe('walking');
    expect(m.holderId).toBeNull();
  });
});

describe('nmeye kills', () => {
  it('killing an Nmeye is a big explosion with hit-stop', () => {
    const s = createGameState(1);
    killEnemy(s, addEnemy(s, 'nmeye', 2000, 300));
    expect(s.score).toBe(ENEMY_STATS.nmeye.points);
    expect(s.hitStop).toBe(HITSTOP_NMEYE);
    expect(s.events).toContainEqual({ type: 'explosion', x: 2000, y: 300, source: 'nmeye', big: true });
  });
});
```

Edit `tests/game/systems/powerups.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
describe('triggerBomb', () => {
  it('kills on-screen enemies, spares distant ones, clears nearby shots', () => {
    const s = createGameState(1);
    const near1 = addEnemy(s, 'snatcher', s.player.x + 300, 300);
    const near2 = addEnemy(s, 'nemesite', s.player.x - 300, 300);
    const far = addEnemy(s, 'snatcher', s.player.x + 3000, 300);
    s.shots.push({ x: s.player.x + 100, y: 300, vx: 0, vy: 0, life: 1 });
    s.shots.push({ x: s.player.x + 3000, y: 300, vx: 0, vy: 0, life: 1 });
    expect(triggerBomb(s)).toBe(true);
```

   with:

```ts
describe('triggerBomb', () => {
  it('kills on-screen enemies, spares distant ones, clears nearby shots', () => {
    const s = createGameState(1);
    const near1 = addEnemy(s, 'nemesite', s.player.x + 300, 300);
    const near2 = addEnemy(s, 'nemesite', s.player.x - 300, 300);
    const far = addEnemy(s, 'nemesite', s.player.x + 3000, 300);
    s.shots.push({ x: s.player.x + 100, y: 300, vx: 0, vy: 0, life: 1 });
    s.shots.push({ x: s.player.x + 3000, y: 300, vx: 0, vy: 0, life: 1 });
    expect(triggerBomb(s)).toBe(true);
```

2. Replace:

```ts
  it('is centred on the led screen, not on the player', () => {
    const s = createGameState(1);
    s.player.facing = 1;
    const ahead = addEnemy(s, 'snatcher', s.player.x + 800, 300);
    const behind = addEnemy(s, 'snatcher', s.player.x - 550, 300);
    triggerBomb(s);
    expect(ahead.dead).toBe(true);
    expect(behind.dead).toBe(false);
    expect(CAMERA_LEAD).toBeGreaterThan(0);
  });

  it('kills fragments spawned by bombed orbs', () => {
    const s = createGameState(1);
    addEnemy(s, 'orb', s.player.x + 200, 300);
    triggerBomb(s);
    expect(s.enemies.filter((e) => !e.dead)).toHaveLength(0);
  });

  it('does nothing without bombs or while dead', () => {
```

   with:

```ts
  it('is centred on the led screen, not on the player', () => {
    const s = createGameState(1);
    s.player.facing = 1;
    const ahead = addEnemy(s, 'nemesite', s.player.x + 800, 300);
    const behind = addEnemy(s, 'nemesite', s.player.x - 550, 300);
    triggerBomb(s);
    expect(ahead.dead).toBe(true);
    expect(behind.dead).toBe(false);
    expect(CAMERA_LEAD).toBeGreaterThan(0);
  });

  it('does nothing without bombs or while dead', () => {
```

Edit `tests/game/systems/rescue.test.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { spawnMen, updateMen, canDeliver, checkUnstable, rescuePoints } from '../../../src/game/systems/rescue';
import { registerKill } from '../../../src/game/systems/scoring';
import {
  SIM_DT, MAN_CARRY_OFFSET, MAN_SAFE_FALL, MAN_RADIUS, CATCH_POINTS, PLAYER_RADIUS, SNATCH_CARRY_OFFSET,
  MAN_WALK_SPEED, BASE_WIDTH,
} from '../../../src/game/constants';
import { groundYAt, BASE_GROUND_Y } from '../../../src/game/terrain';
```

   with:

```ts
import { spawnMen, updateMen, canDeliver, checkUnstable, rescuePoints } from '../../../src/game/systems/rescue';
import { registerKill } from '../../../src/game/systems/scoring';
import {
  SIM_DT, MAN_CARRY_OFFSET, MAN_SAFE_FALL, MAN_RADIUS, CATCH_POINTS, PLAYER_RADIUS,
  MAN_WALK_SPEED, BASE_WIDTH,
} from '../../../src/game/constants';
import { groundYAt, BASE_GROUND_Y } from '../../../src/game/terrain';
```

2. Replace:

```ts
  });
});

describe('snatched', () => {
  it('follows the holder and falls when the holder is gone', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'snatched');
    const e = addEnemy(s, 'snatcher', 3050, 250);
    m.holderId = e.id;
    updateMen(s, SIM_DT);
    expect(m.x).toBe(3050);
    expect(m.y).toBe(250 + SNATCH_CARRY_OFFSET);
    e.dead = true;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('falling');
  });
});

describe('chased', () => {
  it('a chased man keeps walking and can be picked up', () => {
    const s = createGameState(1);
```

   with:

```ts
  });
});

describe('chased', () => {
  it('a chased man keeps walking and can be picked up', () => {
    const s = createGameState(1);
```

3. Replace:

```ts
    const nemesite = addEnemy(s, 'nemesite', 6000, 300);
    checkUnstable(s);
    expect(s.unstable).toBe(true);
    expect(s.menRemaining).toBe(0);
    expect(planter.kind).toBe('antimatter');
    expect(android.kind).toBe('antimatter');
    expect(planter.orbitX).toBeCloseTo(4000 - 80);
```

   with:

```ts
    const nemesite = addEnemy(s, 'nemesite', 6000, 300);
    checkUnstable(s);
    expect(s.unstable).toBe(true);
    expect(planter.kind).toBe('antimatter');
    expect(android.kind).toBe('antimatter');
    expect(planter.orbitX).toBeCloseTo(4000 - 80);
```

Replace the whole content of `tests/game/update.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../src/game/state';
import { NO_ACTIONS } from '../../src/core/input';
import { update } from '../../src/game/update';
import { newGame } from '../../src/game/systems/waves';
import { SIM_DT, PLAYER_RADIUS } from '../../src/game/constants';
import { BASE_GROUND_Y } from '../../src/game/terrain';
import { addMan, addEnemy } from './helpers';

describe('update', () => {
  it('advances time and moves the player', () => {
    const s = createGameState(1);
    addEnemy(s, 'spore', 6000, 300); // keep the wave from clearing
    const x = s.player.x;
    update(s, { ...NO_ACTIONS, moveX: 1 }, SIM_DT);
    expect(s.time).toBeCloseTo(SIM_DT);
    expect(s.player.x).toBeGreaterThan(x);
  });

  it('freezes during hit-stop', () => {
    const s = createGameState(1);
    s.hitStop = 0.05;
    const x = s.player.x;
    update(s, { ...NO_ACTIONS, moveX: 1 }, SIM_DT);
    expect(s.time).toBe(0);
    expect(s.player.x).toBe(x);
    expect(s.hitStop).toBeCloseTo(0.05 - SIM_DT);
  });

  it('snaps previous position to current during hit-stop (no interpolation jitter)', () => {
    const s = createGameState(1);
    s.hitStop = 0.05;
    s.player.prevX = s.player.x - 10;
    s.player.prevY = s.player.y - 10;
    update(s, NO_ACTIONS, SIM_DT);
    expect(s.player.prevX).toBe(s.player.x);
    expect(s.player.prevY).toBe(s.player.y);
  });

  it('does nothing after game over', () => {
    const s = createGameState(1);
    s.phase = 'gameOver';
    update(s, NO_ACTIONS, SIM_DT);
    expect(s.time).toBe(0);
  });

  it('shooting an enemy in front of the player kills it through the full pipeline', () => {
    const s = createGameState(1);
    addEnemy(s, 'spore', 6000, 300); // keep the wave from clearing
    const target = addEnemy(s, 'nemesite', s.player.x + 250, s.player.y);
    target.fireTimer = Infinity;
    target.speed = 0;
    for (let i = 0; i < 30; i++) update(s, { ...NO_ACTIONS, fire: true }, SIM_DT);
    expect(s.enemies.includes(target)).toBe(false);
    expect(s.score).toBeGreaterThan(0);
  });

  it('delivering a man through update scores the rescue', () => {
    const s = createGameState(1);
    s.wave = 2;
    addEnemy(s, 'spore', 6000, 300);
    const m = addMan(s, s.baseX, 'carried');
    s.player.carryingId = m.id;
    s.player.y = BASE_GROUND_Y - PLAYER_RADIUS;
    update(s, NO_ACTIONS, SIM_DT);
    expect(m.state).toBe('saved');
    expect(s.score).toBe(200);
  });

  it('a cleared wave advances to the next wave', () => {
    const s = newGame(5);
    s.enemies = [];
    for (const m of s.men) m.state = 'saved';
    update(s, NO_ACTIONS, SIM_DT);
    expect(s.phase).toBe('waveComplete');
    for (let t = 0; t < 4; t += SIM_DT) update(s, NO_ACTIONS, SIM_DT);
    expect(s.phase).toBe('playing');
    expect(s.wave).toBe(2);
  });
});

describe('update hazards', () => {
  it('moves hazards and lets them kill the player', () => {
    const s = createGameState(1);
    addEnemy(s, 'spore', 6000, 300);
    s.acid.push({ x: s.player.x, y: s.player.y - 30, vy: 220 });
    for (let i = 0; i < 30 && s.player.alive; i++) update(s, NO_ACTIONS, SIM_DT);
    expect(s.player.alive).toBe(false);
    expect(s.acid).toHaveLength(0);
  });
});

describe('update volcanoes', () => {
  it('volcanoes erupt during play', () => {
    const s = createGameState(1);
    addEnemy(s, 'spore', 6000, 300);
    s.player.invuln = 999;
    for (let t = 0; t < 4.1; t += SIM_DT) update(s, NO_ACTIONS, SIM_DT);
    expect(s.events.some((e) => e.type === 'volcanoErupt')).toBe(true);
  });
});
```

Edit `tests/render/effects.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import type { GameEvent } from '../../src/game/events';

const s = createGameState(1);
const explosion: GameEvent = { type: 'explosion', x: 1000, y: 300, source: 'snatcher', big: false };

describe('Effects', () => {
  it('explosions spawn particles and add trauma (screen shake)', () => {
```

   with:

```ts
import type { GameEvent } from '../../src/game/events';

const s = createGameState(1);
const explosion: GameEvent = { type: 'explosion', x: 1000, y: 300, source: 'planter', big: false };

describe('Effects', () => {
  it('explosions spawn particles and add trauma (screen shake)', () => {
```

Replace the whole content of `tests/scenes/demo.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../src/game/state';
import { demoActions } from '../../src/scenes/demo';
import { addEnemy } from '../game/helpers';

describe('demoActions', () => {
  it('idles when there are no enemies', () => {
    const s = createGameState(1);
    const a = demoActions(s);
    expect(a.fire).toBe(false);
  });

  it('fires at a level enemy it is facing within range', () => {
    const s = createGameState(1);
    s.player.facing = 1;
    addEnemy(s, 'nemesite', s.player.x + 280, s.player.y + 5);
    const a = demoActions(s);
    expect(a.fire).toBe(true);
    expect(a.moveX).toBeGreaterThanOrEqual(0);
  });

  it('flies toward a distant enemy', () => {
    const s = createGameState(1);
    addEnemy(s, 'nemesite', s.player.x - 2000, s.player.y);
    expect(demoActions(s).moveX).toBe(-1);
  });

  it('climbs or dives to line up with the enemy', () => {
    const s = createGameState(1);
    addEnemy(s, 'nemesite', s.player.x + 400, s.player.y - 200);
    expect(demoActions(s).moveY).toBeLessThan(0);
  });

  it('does nothing while dead', () => {
    const s = createGameState(1);
    s.player.alive = false;
    addEnemy(s, 'nemesite', s.player.x + 280, s.player.y);
    const a = demoActions(s);
    expect(a.fire).toBe(false);
    expect(a.moveX).toBe(0);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/audio/eventAudio.test.ts tests/game/entities/enemies.test.ts tests/game/state.test.ts tests/game/systems/ai/index.test.ts tests/game/systems/ai/spawners.test.ts tests/game/systems/combat.test.ts tests/game/systems/powerups.test.ts tests/game/systems/rescue.test.ts tests/game/update.test.ts tests/render/effects.test.ts tests/scenes/demo.test.ts`
Expected: FAIL: `enemies.test.ts` "only the eight original kinds exist" (the old four are still in `ENEMY_STATS`). The rest of the edited tests already pass; they no longer use the deleted kinds.

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (4 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const MAN_TURN_MIN = 1;
export const MAN_TURN_MAX = 2;
export const MAN_CARRY_OFFSET = 26;
export const SNATCH_CARRY_OFFSET = 20;
/** Carried delivery scores 100 x wave, capped at 500. */
export const RESCUE_POINTS_PER_WAVE = 100;
export const RESCUE_POINTS_CAP = 500;
```

   with:

```ts
export const MAN_TURN_MIN = 1;
export const MAN_TURN_MAX = 2;
export const MAN_CARRY_OFFSET = 26;
/** Carried delivery scores 100 x wave, capped at 500. */
export const RESCUE_POINTS_PER_WAVE = 100;
export const RESCUE_POINTS_CAP = 500;
```

2. Replace:

```ts
// Enemies
export const ENEMY_SHOT_SPEED = 380;
export const ENEMY_SHOT_LIFE = 3;
export const TRAIL_LIFE = 1.5;
export const TRAIL_INTERVAL = 0.05;
export const TRAIL_RADIUS = 6;
/** The first Nmeye appears this many seconds into a wave, then one every NMEYE_REPEAT seconds. */
export const NMEYE_DELAY = 60;
export const NMEYE_REPEAT = 20;
```

   with:

```ts
// Enemies
export const ENEMY_SHOT_SPEED = 380;
export const ENEMY_SHOT_LIFE = 3;
/** The first Nmeye appears this many seconds into a wave, then one every NMEYE_REPEAT seconds. */
export const NMEYE_DELAY = 60;
export const NMEYE_REPEAT = 20;
```

3. Replace:

```ts
export const EYE_BOMB_RADIUS = 5;

// Waves
export const MILESTONE_EVERY = 5;
/** Every 5th wave is a Trailer invasion; the wave after each one (from wave 6) is a shipment. */
export const INVASION_EVERY = 5;
export const INVASION_BASE_TRAILERS = 6;
```

   with:

```ts
export const EYE_BOMB_RADIUS = 5;

// Waves
/** Every 5th wave is a Trailer invasion; the wave after each one (from wave 6) is a shipment. */
export const INVASION_EVERY = 5;
export const INVASION_BASE_TRAILERS = 6;
```

4. Replace:

```ts
export const LAST_WAVE = 99;
export const CYCLE_START = 95;
export const WAVE_COMPLETE_TIME = 3;
/** Seconds into a wave before any snatcher may target a man. */
export const SNATCH_GRACE = 8;
/** Minimum horizontal distance from the player when spawning wave enemies. */
export const SPAWN_SAFE_DISTANCE = 700;

// Hit-stop durations (seconds)
export const HITSTOP_MULTI = 0.03;
export const HITSTOP_HUNTER = 0.04;
```

   with:

```ts
export const LAST_WAVE = 99;
export const CYCLE_START = 95;
export const WAVE_COMPLETE_TIME = 3;
/** Minimum horizontal distance from the player when spawning wave enemies. */
export const SPAWN_SAFE_DISTANCE = 700;

// Hit-stop durations (seconds)
export const HITSTOP_MULTI = 0.03;
export const HITSTOP_NMEYE = 0.04;
```

Edit `src/game/state.ts` (8 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  carryingId: number | null;
}

export type ManState = 'walking' | 'carried' | 'snatched' | 'chased' | 'falling' | 'saved' | 'dead';

export interface Man {
  id: number;
```

   with:

```ts
  carryingId: number | null;
}

export type ManState = 'walking' | 'carried' | 'chased' | 'falling' | 'saved' | 'dead';

export interface Man {
  id: number;
```

2. Replace:

```ts
  dir: Facing;
  state: ManState;
  fallStartY: number;
  /** Enemy id while snatched (holder) or chased (the Android chasing him). */
  holderId: number | null;
  walkTimer: number;
}

export type EnemyKind =
  | 'snatcher' | 'orb' | 'fragment' | 'hunter'
  | 'planter' | 'android' | 'nemesite' | 'spore' | 'trailer' | 'blunderstorm' | 'nmeye' | 'antimatter';

export interface Enemy {
  id: number;
```

   with:

```ts
  dir: Facing;
  state: ManState;
  fallStartY: number;
  /** Enemy id of the Android chasing him while chased. */
  holderId: number | null;
  walkTimer: number;
}

export type EnemyKind = 'planter' | 'android' | 'nemesite' | 'spore' | 'trailer' | 'blunderstorm' | 'nmeye' | 'antimatter';

export interface Enemy {
  id: number;
```

3. Replace:

```ts
  fireTimer: number;
  /** Free-running phase for sine motion / animation. */
  phase: number;
  /** Trailer: centre line of its weave. */
  homeY: number;
  /** Snatcher: man being hunted. */
  targetId: number | null;
  /** Snatcher: man being carried. */
  carryingId: number | null;
  aggressive: boolean;
  trailTimer: number;
  /** Planter: id of the Android it is lowering. Android: id of the Planter lowering it. */
  linkedId: number | null;
  /** Planter: current tether length in px while lowering. */
```

   with:

```ts
  fireTimer: number;
  /** Free-running phase for sine motion / animation. */
  phase: number;
  /** Trailer: centre line of its weave. Planter: cruise height. Blunderstorm: band height. */
  homeY: number;
  /** Android: the man it is chasing. */
  targetId: number | null;
  /** Planter: id of the Android it is lowering. Android: id of the Planter lowering it. */
  linkedId: number | null;
  /** Planter: current tether length in px while lowering. */
```

4. Replace:

```ts
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface TrailSeg {
  x: number;
  y: number;
  life: number;
}
```

   with:

```ts
  y: number;
  vx: number;
  vy: number;
  life: number;
}
```

5. Replace:

```ts
  comboTimer: number;
  hitStop: number;
  unstable: boolean;
  /** Men to spawn at the start of the next wave. */
  menRemaining: number;
  savedThisWave: number;
  lastWaveBonus: number;
  speedScale: number;
```

   with:

```ts
  comboTimer: number;
  hitStop: number;
  unstable: boolean;
  savedThisWave: number;
  lastWaveBonus: number;
  speedScale: number;
```

6. Replace:

```ts
  enemies: Enemy[];
  lasers: Laser[];
  shots: Shot[];
  trails: TrailSeg[];
  magma: Magma[];
  acid: Acid[];
  bolts: Bolt[];
```

   with:

```ts
  enemies: Enemy[];
  lasers: Laser[];
  shots: Shot[];
  magma: Magma[];
  acid: Acid[];
  bolts: Bolt[];
```

7. Replace:

```ts
    comboTimer: 0,
    hitStop: 0,
    unstable: false,
    menRemaining: MEN_PER_WAVE,
    savedThisWave: 0,
    lastWaveBonus: 0,
    speedScale: 1,
```

   with:

```ts
    comboTimer: 0,
    hitStop: 0,
    unstable: false,
    savedThisWave: 0,
    lastWaveBonus: 0,
    speedScale: 1,
```

8. Replace:

```ts
    enemies: [],
    lasers: [],
    shots: [],
    trails: [],
    magma: [],
    acid: [],
    bolts: [],
```

   with:

```ts
    enemies: [],
    lasers: [],
    shots: [],
    magma: [],
    acid: [],
    bolts: [],
```

Replace the whole content of `src/game/events.ts` with:

```ts
import type { EnemyKind } from './state';

export type ExplosionSource = EnemyKind | 'player' | 'man';

export type GameEvent =
  | { type: 'laserFired'; x: number; y: number; facing: 1 | -1 }
  | { type: 'enemyShot'; x: number; y: number }
  | { type: 'explosion'; x: number; y: number; source: ExplosionSource; big: boolean }
  | { type: 'scorePopup'; x: number; y: number; points: number; multiplier: number }
  | { type: 'manPickedUp'; x: number; y: number }
  | { type: 'manCaught'; x: number; y: number }
  | { type: 'manRescued'; x: number; y: number }
  | { type: 'manDied'; x: number; y: number }
  | { type: 'playerDied'; x: number; y: number }
  | { type: 'playerRespawned'; x: number; y: number }
  | { type: 'bombDetonated'; x: number; y: number }
  | { type: 'cloakOn' }
  | { type: 'cloakOff' }
  | { type: 'waveStarted'; wave: number }
  | { type: 'waveCleared'; wave: number; bonus: number; saved: number }
  | { type: 'extraLife' }
  | { type: 'manWhistle'; x: number; y: number }
  | { type: 'manSelfRescued'; x: number; y: number }
  | { type: 'nemesiteWarning'; x: number; y: number }
  | { type: 'rumble'; x: number; y: number }
  | { type: 'protonBolt'; x: number; top: number; bottom: number }
  | { type: 'volcanoErupt'; x: number; y: number; whiteHot: boolean }
  | { type: 'planetUnstable' }
  | { type: 'invasionWave'; wave: number }
  | { type: 'nmeyeSpawned'; x: number; y: number }
  | { type: 'laserBlocked'; x: number; y: number }
  | { type: 'gameOver'; score: number };

export function emit(target: { events: GameEvent[] }, e: GameEvent): void {
  target.events.push(e);
}
```

Replace the whole content of `src/game/entities/enemies.ts` with:

```ts
import { wrapX } from '../../core/world';
import { range, chance } from '../../core/rng';
import { allocId, type GameState, type Enemy, type EnemyKind } from '../state';
import {
  PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX, STORM_BAND_TOP, STORM_BAND_BOTTOM, STORM_ACTION_MIN, STORM_ACTION_MAX,
  TRAILER_HOMER_CHANCE, NMEYE_BOMB_INTERVAL, ANTIMATTER_ORBIT_RADIUS, ANDROID_FALLING_POINTS,
} from '../constants';

export interface EnemyStats {
  radius: number;
  points: number;
  speed: number;
  /** Multiplier on the wave's enemy fire interval; 0 = never fires. */
  fireMult: number;
}

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  planter: { radius: 15, points: 250, speed: 90, fireMult: 2 },
  android: { radius: 9, points: 50, speed: 29, fireMult: 0 },
  nemesite: { radius: 13, points: 150, speed: 260, fireMult: 0.6 },
  spore: { radius: 14, points: 750, speed: 50, fireMult: 0 },
  trailer: { radius: 14, points: 250, speed: 200, fireMult: 1.5 },
  blunderstorm: { radius: 24, points: 250, speed: 40, fireMult: 0 },
  nmeye: { radius: 14, points: 100, speed: 760, fireMult: 0 },
  antimatter: { radius: 12, points: 150, speed: 160, fireMult: 0 },
};

/** Points for killing this enemy right now (a falling Android is worth more). */
export function killPoints(e: Enemy): number {
  if (e.kind === 'android' && e.falling) return ANDROID_FALLING_POINTS;
  return ENEMY_STATS[e.kind].points;
}

export function fireInterval(s: GameState, e: Enemy): number {
  const m = ENEMY_STATS[e.kind].fireMult;
  if (m === 0) return Infinity;
  return s.enemyFireInterval * m;
}

export function resetFireTimer(s: GameState, e: Enemy): void {
  const i = fireInterval(s, e);
  e.fireTimer = i === Infinity ? Infinity : i * range(s.rng, 0.7, 1.3);
}

function speedFor(s: GameState, kind: EnemyKind): number {
  return ENEMY_STATS[kind].speed * s.speedScale;
}

/** Puts an Antimatter on its orbit so that its current position is angle 0 of the circle. */
export function startOrbit(e: Enemy): void {
  e.orbitAngle = 0;
  e.orbitX = wrapX(e.x - ANTIMATTER_ORBIT_RADIUS);
  e.orbitY = e.y;
}

/** Creates an enemy. The caller is responsible for pushing it into s.enemies. */
export function createEnemy(s: GameState, kind: EnemyKind, x: number, y: number): Enemy {
  const e: Enemy = {
    id: allocId(s),
    kind,
    x: wrapX(x),
    y,
    vx: 0,
    vy: 0,
    radius: ENEMY_STATS[kind].radius,
    speed: speedFor(s, kind),
    fireTimer: 0,
    phase: range(s.rng, 0, Math.PI * 2),
    homeY: y,
    targetId: null,
    linkedId: null,
    tetherLen: 0,
    dodgeTimer: 0,
    dodgeDir: 1,
    warned: false,
    homer: false,
    falling: false,
    orbitAngle: 0,
    orbitX: 0,
    orbitY: 0,
    actionTimer: 0,
    bombTimer: 0,
    boltTimer: 0,
    dead: false,
  };
  switch (kind) {
    case 'trailer':
      e.vx = chance(s.rng, 0.5) ? e.speed : -e.speed;
      e.homer = chance(s.rng, TRAILER_HOMER_CHANCE);
      break;
    case 'planter':
      e.homeY = range(s.rng, PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX);
      e.y = e.homeY;
      e.vx = chance(s.rng, 0.5) ? e.speed : -e.speed;
      break;
    case 'spore': {
      const a = range(s.rng, 0, Math.PI * 2);
      e.vx = Math.cos(a) * e.speed;
      e.vy = Math.sin(a) * e.speed;
      break;
    }
    case 'blunderstorm':
      e.homeY = range(s.rng, STORM_BAND_TOP, STORM_BAND_BOTTOM);
      e.y = e.homeY;
      e.vx = chance(s.rng, 0.5) ? e.speed : -e.speed;
      e.actionTimer = range(s.rng, STORM_ACTION_MIN, STORM_ACTION_MAX);
      break;
    case 'nmeye':
      e.bombTimer = NMEYE_BOMB_INTERVAL;
      break;
    case 'antimatter':
      startOrbit(e);
      break;
    default:
      break;
  }
  resetFireTimer(s, e);
  return e;
}

export function convertEnemy(s: GameState, e: Enemy, kind: EnemyKind): void {
  e.kind = kind;
  e.radius = ENEMY_STATS[kind].radius;
  e.speed = speedFor(s, kind);
  e.targetId = null;
  e.linkedId = null;
  e.tetherLen = 0;
  e.falling = false;
  e.dodgeTimer = 0;
  resetFireTimer(s, e);
}
```

Replace the whole content of `src/game/systems/ai/index.ts` with:

```ts
import { wrapX, shortestDx } from '../../../core/world';
import type { GameState, Enemy } from '../../state';
import { emit } from '../../events';
import { groundYAt } from '../../terrain';
import { resetFireTimer } from '../../entities/enemies';
import { CEILING_Y, ENEMY_SHOT_SPEED, ENEMY_SHOT_LIFE, ENEMY_FIRE_RANGE } from '../../constants';
import { playerVisible } from './common';
import { updatePlanter, updateAndroid } from './planter';
import { updateNemesite, updateNmeye, updateAntimatter } from './homers';
import { updateTrailer } from './spawners';
import { updateBlunderstorm } from './storm';

function integrate(s: GameState, e: Enemy, dt: number): void {
  e.x = wrapX(e.x + e.vx * dt);
  e.y += e.vy * dt;
  if (e.y < CEILING_Y) {
    e.y = CEILING_Y;
    if (e.vy < 0) e.vy = -e.vy;
  }
  const floor = groundYAt(s.terrain, e.x) - e.radius;
  if (e.y > floor) {
    e.y = floor;
    if (e.vy > 0) e.vy = -e.vy;
  }
}

function fireAtPlayer(s: GameState, e: Enemy): void {
  const p = s.player;
  const dx = shortestDx(e.x, p.x);
  const dy = p.y - e.y;
  const t = Math.hypot(dx, dy) / ENEMY_SHOT_SPEED;
  const ax = dx + p.vx * t * 0.5;
  const ay = dy + p.vy * t * 0.5;
  const d = Math.hypot(ax, ay) || 1;
  s.shots.push({
    x: e.x,
    y: e.y,
    vx: (ax / d) * ENEMY_SHOT_SPEED,
    vy: (ay / d) * ENEMY_SHOT_SPEED,
    life: ENEMY_SHOT_LIFE,
  });
  emit(s, { type: 'enemyShot', x: e.x, y: e.y });
}

function updateEnemyFire(s: GameState, e: Enemy, dt: number): void {
  if (e.fireTimer === Infinity) return;
  e.fireTimer -= dt;
  if (e.fireTimer > 0) return;
  resetFireTimer(s, e);
  if (!playerVisible(s)) return;
  if (Math.abs(shortestDx(e.x, s.player.x)) > ENEMY_FIRE_RANGE) return;
  fireAtPlayer(s, e);
}

/** Runs each living enemy's behaviour, then moves it and lets it shoot. */
export function updateEnemies(s: GameState, dt: number): void {
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.phase += dt;
    switch (e.kind) {
      case 'planter':
        updatePlanter(s, e, dt);
        break;
      case 'android':
        updateAndroid(s, e, dt);
        break;
      case 'nemesite':
        updateNemesite(s, e, dt);
        break;
      case 'trailer':
        updateTrailer(s, e, dt);
        break;
      case 'blunderstorm':
        updateBlunderstorm(s, e, dt);
        break;
      case 'nmeye':
        updateNmeye(s, e, dt);
        break;
      case 'antimatter':
        updateAntimatter(s, e, dt);
        break;
      case 'spore':
        break;
    }
    integrate(s, e, dt);
    updateEnemyFire(s, e, dt);
  }
}

export function updateShots(s: GameState, dt: number): void {
  for (const sh of s.shots) {
    sh.x = wrapX(sh.x + sh.vx * dt);
    sh.y += sh.vy * dt;
    sh.life -= dt;
    if (sh.y < CEILING_Y || sh.y > groundYAt(s.terrain, sh.x)) sh.life = 0;
  }
  s.shots = s.shots.filter((sh) => sh.life > 0);
}
```

Replace the whole content of `src/game/systems/combat.ts` with:

```ts
import type { GameState, Enemy } from '../state';
import { emit } from '../events';
import { findMan, findEnemy } from '../query';
import { convertEnemy, killPoints } from '../entities/enemies';
import { laserHitsCircle, circlesOverlap } from './collision';
import { registerKill, resetCombo } from './scoring';
import { releaseTrailers, trailerHeadHit } from './ai/spawners';
import {
  HITSTOP_MULTI, HITSTOP_NMEYE, PLAYER_RADIUS, MAN_RADIUS, RESPAWN_DELAY,
} from '../constants';

const SHOT_RADIUS = 3;

export function killEnemy(s: GameState, e: Enemy): void {
  if (e.dead) return;
  e.dead = true;

  if (e.kind === 'planter' && e.linkedId !== null) {
    // Killed while lowering: its Android drops.
    const android = findEnemy(s, e.linkedId);
    if (android && android.linkedId === e.id) {
      android.linkedId = null;
      android.falling = true;
      android.vy = 0;
    }
  }

  if (e.kind === 'android') {
    if (e.linkedId !== null) {
      const planter = findEnemy(s, e.linkedId);
      if (planter && planter.linkedId === e.id) convertEnemy(s, planter, 'nemesite');
    }
    if (e.targetId !== null) {
      const m = findMan(s, e.targetId);
      if (m && m.state === 'chased' && m.holderId === e.id) {
        m.state = 'walking';
        m.holderId = null;
      }
    }
  }

  if (e.kind === 'spore') releaseTrailers(s, e);

  registerKill(s, killPoints(e), e.x, e.y);
  const big = e.kind === 'nmeye' || e.kind === 'spore';
  emit(s, { type: 'explosion', x: e.x, y: e.y, source: e.kind, big });
  if (e.kind === 'nmeye') s.hitStop = Math.max(s.hitStop, HITSTOP_NMEYE);
}

export function resolveLaserHits(s: GameState): void {
  let kills = 0;
  for (const l of s.lasers) {
    if (l.life <= 0) continue;
    for (const e of s.enemies) {
      if (e.dead) continue;
      if (laserHitsCircle(l, e.x, e.y, e.radius)) {
        l.life = 0;
        if (e.kind === 'trailer' && !trailerHeadHit(l, e)) {
          // Tail hit: the laser is absorbed and the Trailer survives.
          emit(s, { type: 'laserBlocked', x: e.x, y: e.y });
          break;
        }
        killEnemy(s, e);
        kills++;
        break;
      }
    }
  }
  if (kills >= 2) s.hitStop = Math.max(s.hitStop, HITSTOP_MULTI);
}

export function killPlayer(s: GameState): void {
  const p = s.player;
  if (!p.alive) return;
  p.alive = false;
  p.respawnTimer = RESPAWN_DELAY;
  p.cloakActive = false;
  p.vx = 0;
  p.vy = 0;
  if (p.carryingId !== null) {
    const m = findMan(s, p.carryingId);
    if (m && m.state === 'carried') {
      m.state = 'falling';
      m.vy = 0;
      m.fallStartY = m.y;
    }
    p.carryingId = null;
  }
  resetCombo(s);
  s.lives -= 1;
  emit(s, { type: 'playerDied', x: p.x, y: p.y });
  emit(s, { type: 'explosion', x: p.x, y: p.y, source: 'player', big: true });
  if (s.lives <= 0) {
    s.lives = 0;
    s.phase = 'gameOver';
    emit(s, { type: 'gameOver', score: s.score });
  }
}

/** True if an enemy or enemy shot overlaps the circle. Consumes a shot that hits. */
function hitByHazard(s: GameState, x: number, y: number, r: number): boolean {
  for (const e of s.enemies) {
    if (!e.dead && circlesOverlap(x, y, r, e.x, e.y, e.radius)) return true;
  }
  for (const sh of s.shots) {
    if (sh.life > 0 && circlesOverlap(x, y, r, sh.x, sh.y, SHOT_RADIUS)) {
      sh.life = 0;
      return true;
    }
  }
  return false;
}

export function resolvePlayerHits(s: GameState): void {
  const p = s.player;
  if (!p.alive || p.invuln > 0 || p.cloakActive) return;

  if (p.carryingId !== null) {
    const m = findMan(s, p.carryingId);
    if (m && hitByHazard(s, m.x, m.y, MAN_RADIUS)) {
      m.state = 'dead';
      p.carryingId = null;
      emit(s, { type: 'manDied', x: m.x, y: m.y });
      emit(s, { type: 'explosion', x: m.x, y: m.y, source: 'man', big: false });
    }
  }

  if (hitByHazard(s, p.x, p.y, PLAYER_RADIUS * 0.8)) killPlayer(s);
}

export function pruneDead(s: GameState): void {
  s.enemies = s.enemies.filter((e) => !e.dead);
  s.lasers = s.lasers.filter((l) => l.life > 0);
  s.shots = s.shots.filter((sh) => sh.life > 0);
}
```

Edit `src/game/systems/rescue.ts` (4 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { circlesOverlap } from './collision';
import { awardBonus } from './scoring';
import {
  MAN_RADIUS, MAN_WALK_SPEED, MAN_FALL_GRAVITY, MAN_SAFE_FALL, MAN_CARRY_OFFSET, SNATCH_CARRY_OFFSET,
  PLAYER_RADIUS, RESCUE_POINTS_PER_WAVE, RESCUE_POINTS_CAP, CATCH_POINTS, BASE_WIDTH, BASE_DELIVERY_HEIGHT,
  MAN_TURN_MIN, MAN_TURN_MAX,
} from '../constants';
```

   with:

```ts
import { circlesOverlap } from './collision';
import { awardBonus } from './scoring';
import {
  MAN_RADIUS, MAN_WALK_SPEED, MAN_FALL_GRAVITY, MAN_SAFE_FALL, MAN_CARRY_OFFSET,
  PLAYER_RADIUS, RESCUE_POINTS_PER_WAVE, RESCUE_POINTS_CAP, CATCH_POINTS, BASE_WIDTH, BASE_DELIVERY_HEIGHT,
  MAN_TURN_MIN, MAN_TURN_MAX,
} from '../constants';
```

2. Replace:

```ts
  }
}

function updateSnatched(s: GameState, m: Man): void {
  const holder = m.holderId !== null ? findEnemy(s, m.holderId) : undefined;
  if (!holder) {
    startFalling(m);
    return;
  }
  m.x = holder.x;
  m.y = holder.y + SNATCH_CARRY_OFFSET;
}

function updateFalling(s: GameState, m: Man, dt: number): void {
  const p = s.player;
  m.vy += MAN_FALL_GRAVITY * dt;
```

   with:

```ts
  }
}

function updateFalling(s: GameState, m: Man, dt: number): void {
  const p = s.player;
  m.vy += MAN_FALL_GRAVITY * dt;
```

3. Replace:

```ts
      case 'carried':
        updateCarried(s, m);
        break;
      case 'snatched':
        updateSnatched(s, m);
        break;
      case 'falling':
        updateFalling(s, m, dt);
        break;
```

   with:

```ts
      case 'carried':
        updateCarried(s, m);
        break;
      case 'falling':
        updateFalling(s, m, dt);
        break;
```

4. Replace:

```ts
  if (s.unstable || s.men.length === 0) return;
  if (!s.men.every((m) => m.state === 'dead')) return;
  s.unstable = true;
  s.menRemaining = 0;
  for (const e of s.enemies) {
    if (e.dead || (e.kind !== 'planter' && e.kind !== 'android')) continue;
    convertEnemy(s, e, 'antimatter');
```

   with:

```ts
  if (s.unstable || s.men.length === 0) return;
  if (!s.men.every((m) => m.state === 'dead')) return;
  s.unstable = true;
  for (const e of s.enemies) {
    if (e.dead || (e.kind !== 'planter' && e.kind !== 'android')) continue;
    convertEnemy(s, e, 'antimatter');
```

Edit `src/game/update.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import type { GameState } from './state';
import { updatePlayerMovement, updatePlayerTimers } from './systems/player';
import { updateFiring, updateLasers } from './systems/weapons';
import { updateEnemies, updateShots, updateTrails } from './systems/ai';
import { updateMen, checkUnstable } from './systems/rescue';
import { resolveLaserHits, resolvePlayerHits, pruneDead } from './systems/combat';
import { tickCombo } from './systems/scoring';
```

   with:

```ts
import type { GameState } from './state';
import { updatePlayerMovement, updatePlayerTimers } from './systems/player';
import { updateFiring, updateLasers } from './systems/weapons';
import { updateEnemies, updateShots } from './systems/ai';
import { updateMen, checkUnstable } from './systems/rescue';
import { resolveLaserHits, resolvePlayerHits, pruneDead } from './systems/combat';
import { tickCombo } from './systems/scoring';
```

2. Replace:

```ts
  updateLasers(s, dt);
  updateEnemies(s, dt);
  updateShots(s, dt);
  updateTrails(s, dt);
  updateVolcanoes(s, dt);
  updateHazards(s, dt);
  updateMen(s, dt);
```

   with:

```ts
  updateLasers(s, dt);
  updateEnemies(s, dt);
  updateShots(s, dt);
  updateVolcanoes(s, dt);
  updateHazards(s, dt);
  updateMen(s, dt);
```

Edit `src/audio/eventAudio.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
        case 'waveCleared':
          sfx.waveClear();
          break;
        case 'hunterSpawned':
        case 'nmeyeSpawned':
          sfx.hunter();
          break;
```

   with:

```ts
        case 'waveCleared':
          sfx.waveClear();
          break;
        case 'nmeyeSpawned':
          sfx.hunter();
          break;
```

Replace the whole content of `src/render/debug.ts` with:

```ts
import { VIEW_W, SCANNER_H, toScreenX } from '../core/world';
import type { GameState } from '../game/state';
import { MAN_RADIUS, PLAYER_RADIUS } from '../game/constants';

const DEBUG_COLOR = '#7cfc00';

export function drawDebug(ctx: CanvasRenderingContext2D, s: GameState, camX: number, fps: number, particles: number): void {
  const aliveMen = s.men.filter((m) => m.state !== 'dead' && m.state !== 'saved').length;
  const lines = [
    `FPS ${fps.toFixed(0)}`,
    `SEED ${s.seed}`,
    `WAVE ${s.wave}  T ${s.waveTime.toFixed(1)}`,
    `ENEMIES ${s.enemies.length}`,
    `SHOTS ${s.shots.length}  HAZARDS ${s.magma.length + s.acid.length + s.bolts.length + s.eyeBombs.length}`,
    `MEN ${aliveMen}/${s.men.length}`,
    `PARTICLES ${particles}`,
    `MULT x${s.multiplier}  UNSTABLE ${s.unstable}`,
  ];
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = DEBUG_COLOR;
  lines.forEach((l, i) => ctx.fillText(l, 12, SCANNER_H + 20 + i * 15));

  ctx.strokeStyle = DEBUG_COLOR;
  ctx.lineWidth = 1;
  const circle = (x: number, y: number, r: number) => {
    const sx = toScreenX(x, camX);
    if (sx < -50 || sx > VIEW_W + 50) return;
    ctx.beginPath();
    ctx.arc(sx, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  for (const e of s.enemies) circle(e.x, e.y, e.radius);
  for (const m of s.men) if (m.state !== 'dead' && m.state !== 'saved') circle(m.x, m.y, MAN_RADIUS);
  if (s.player.alive) circle(s.player.x, s.player.y, PLAYER_RADIUS * 0.8);
}
```

Edit `src/render/effects.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
            e.x,
            e.y - 14,
            e.multiplier > 1 ? `+${e.points} x${e.multiplier}` : `+${e.points}`,
            e.multiplier > 1 ? PALETTE.hunter : PALETTE.text,
          );
          break;
        case 'manRescued':
```

   with:

```ts
            e.x,
            e.y - 14,
            e.multiplier > 1 ? `+${e.points} x${e.multiplier}` : `+${e.points}`,
            e.multiplier > 1 ? PALETTE.gold : PALETTE.text,
          );
          break;
        case 'manRescued':
```

2. Replace:

```ts
          break;
        case 'manDied':
          this.popup(e.x, e.y - 20, 'MAN LOST', PALETTE.warn);
          break;
        case 'manSnatched':
          this.ring(e.x, e.y, 30, PALETTE.snatcher, 0.3);
          break;
        case 'extraLife':
          this.popup(s.player.x, s.player.y - 40, 'EXTRA LIFE', PALETTE.player);
```

   with:

```ts
          break;
        case 'manDied':
          this.popup(e.x, e.y - 20, 'MAN LOST', PALETTE.warn);
          break;
        case 'extraLife':
          this.popup(s.player.x, s.player.y - 40, 'EXTRA LIFE', PALETTE.player);
```

3. Replace:

```ts
          }
          break;
        }
        case 'hunterSpawned':
          this.ring(e.x, e.y, 90, PALETTE.hunter, 0.5);
          break;
        case 'laserBlocked':
          this.burst(e.x, e.y, PALETTE.laser, 8, 160);
          break;
```

   with:

```ts
          }
          break;
        }
        case 'laserBlocked':
          this.burst(e.x, e.y, PALETTE.laser, 8, 160);
          break;
```

Edit `src/render/hud.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  ctx.font = 'bold 22px monospace';
  ctx.fillText(String(s.score).padStart(8, '0'), 16, 44);
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = s.multiplier > 1 ? PALETTE.hunter : PALETTE.hud;
  ctx.fillText(`x${s.multiplier}`, 16, 66);
  if (s.multiplier > 1) {
    ctx.fillRect(56, 60, 80 * clamp(s.comboTimer / COMBO_WINDOW, 0, 1), 4);
```

   with:

```ts
  ctx.font = 'bold 22px monospace';
  ctx.fillText(String(s.score).padStart(8, '0'), 16, 44);
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = s.multiplier > 1 ? PALETTE.gold : PALETTE.hud;
  ctx.fillText(`x${s.multiplier}`, 16, 66);
  if (s.multiplier > 1) {
    ctx.fillRect(56, 60, 80 * clamp(s.comboTimer / COMBO_WINDOW, 0, 1), 4);
```

2. Replace:

```ts
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = PALETTE.hunter;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < MAX_BOMBS; i++) {
    ctx.beginPath();
    ctx.arc(x0 + 110 + i * 18, 18, 6, 0, Math.PI * 2);
    if (i < s.bombs) {
      ctx.fillStyle = PALETTE.hunter;
      ctx.fill();
    }
    ctx.stroke();
```

   with:

```ts
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < MAX_BOMBS; i++) {
    ctx.beginPath();
    ctx.arc(x0 + 110 + i * 18, 18, 6, 0, Math.PI * 2);
    if (i < s.bombs) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fill();
    }
    ctx.stroke();
```

3. Replace:

```ts
    ctx.font = '20px monospace';
    ctx.fillStyle = PALETTE.man;
    ctx.fillText(`MEN SAVED  ${s.savedThisWave}`, VIEW_W / 2, 350);
    ctx.fillStyle = PALETTE.hunter;
    ctx.fillText(`BONUS  ${s.lastWaveBonus}`, VIEW_W / 2, 384);
  }
  ctx.textAlign = 'left';
```

   with:

```ts
    ctx.font = '20px monospace';
    ctx.fillStyle = PALETTE.man;
    ctx.fillText(`MEN SAVED  ${s.savedThisWave}`, VIEW_W / 2, 350);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`BONUS  ${s.lastWaveBonus}`, VIEW_W / 2, 384);
  }
  ctx.textAlign = 'left';
```

Replace the whole content of `src/render/palette.ts` with:

```ts
import type { ExplosionSource } from '../game/events';

export const PALETTE = {
  player: '#22e6ff',
  man: '#4dff88',
  nemesite: '#ff3b3b',
  trailer: '#ff9a1f',
  gold: '#ffe066',
  planter: '#ff4fd8',
  android: '#b8ff3a',
  spore: '#c56bff',
  blunderstorm: '#8fb8ff',
  nmeye: '#ff5fa0',
  antimatter: '#f0f0ff',
  base: '#19e3c3',
  laser: '#9ff6ff',
  shot: '#ff6a6a',
  terrain: '#3d7bff',
  terrainUnstable: '#ff3b5c',
  magma: '#ff7a1a',
  hotRock: '#fff3c4',
  lake: '#3ff0ff',
  acid: '#9dff3a',
  bolt: '#d8f4ff',
  hud: '#9ad8ff',
  text: '#e8f6ff',
  warn: '#ff4d6d',
} as const;

export function explosionColor(source: ExplosionSource): string {
  return PALETTE[source];
}
```

Edit `src/render/renderer.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { VIEW_W, toScreenX, lerpWrapped } from '../core/world';
import type { GameState } from '../game/state';
import { TRAIL_LIFE, TRAIL_RADIUS, ACID_RADIUS, BOLT_WIDTH, EYE_BOMB_RADIUS } from '../game/constants';
import type { View } from './canvas';
import type { Camera } from './camera';
import { Background } from './background';
```

   with:

```ts
import { VIEW_W, toScreenX, lerpWrapped } from '../core/world';
import type { GameState } from '../game/state';
import { ACID_RADIUS, BOLT_WIDTH, EYE_BOMB_RADIUS } from '../game/constants';
import type { View } from './canvas';
import type { Camera } from './camera';
import { Background } from './background';
```

2. Replace:

```ts
    this.bg.drawLandscape(ctx, s.landscape, s.terrain, cam.x, s.time, s.unstable);
    this.bg.drawBase(ctx, s.baseX, cam.x, s.time);

    this.drawTrails(ctx, s, cam.x);
    this.drawMen(ctx, s, cam.x);
    this.drawEnemies(ctx, s, cam.x);
    this.drawPlayer(ctx, s, cam.x, alpha);
```

   with:

```ts
    this.bg.drawLandscape(ctx, s.landscape, s.terrain, cam.x, s.time, s.unstable);
    this.bg.drawBase(ctx, s.baseX, cam.x, s.time);

    this.drawMen(ctx, s, cam.x);
    this.drawEnemies(ctx, s, cam.x);
    this.drawPlayer(ctx, s, cam.x, alpha);
```

3. Replace:

```ts
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawTrails(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = PALETTE.trailer;
    for (const t of s.trails) {
      const sx = toScreenX(t.x, camX);
      if (!onScreen(sx, 20)) continue;
      ctx.globalAlpha = Math.max(0, t.life / TRAIL_LIFE) * 0.8;
      ctx.beginPath();
      ctx.arc(sx, t.y, TRAIL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private glowDot(ctx: CanvasRenderingContext2D, sx: number, y: number, r: number, color: string): void {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
```

   with:

```ts
    ctx.globalCompositeOperation = 'source-over';
  }

  private glowDot(ctx: CanvasRenderingContext2D, sx: number, y: number, r: number, color: string): void {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
```

Edit `src/render/sprites.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
      line(c, 0, 4, 3, 10);
      c.stroke();
    }),
    snatcher: makeSprite(15, PALETTE.snatcher, (c) => {
      c.beginPath();
      poly(c, [[0, -12], [12, 0], [0, 12], [-12, 0]]);
      circle(c, 0, 0, 3);
      line(c, -6, 8, -9, 15);
      line(c, 6, 8, 9, 15);
      c.stroke();
    }),
    nemesite: makeSprite(14, PALETTE.nemesite, (c) => {
      c.beginPath();
      const pts: Array<[number, number]> = [];
```

   with:

```ts
      line(c, 0, 4, 3, 10);
      c.stroke();
    }),
    nemesite: makeSprite(14, PALETTE.nemesite, (c) => {
      c.beginPath();
      const pts: Array<[number, number]> = [];
```

2. Replace:

```ts
      poly(c, [[-12, -9], [13, 0], [-12, 9], [-6, 0]]);
      line(c, -2, -3, 6, 0);
      line(c, -2, 3, 6, 0);
      c.stroke();
    }),
    orb: makeSprite(16, PALETTE.orb, (c) => {
      c.beginPath();
      circle(c, 0, 0, 14);
      circle(c, 0, 0, 6);
      line(c, -14, 0, 14, 0);
      line(c, 0, -14, 0, 14);
      c.stroke();
    }),
    fragment: makeSprite(8, PALETTE.fragment, (c) => {
      c.beginPath();
      poly(c, [[0, -7], [6, 5], [-6, 5]]);
      c.stroke();
    }),
    hunter: makeSprite(16, PALETTE.hunter, (c) => {
      c.beginPath();
      poly(c, [[0, -15], [16, 0], [0, 15], [-16, 0]]);
      poly(c, [[0, -7], [8, 0], [0, 7], [-8, 0]]);
      line(c, -20, 0, 20, 0);
      c.stroke();
    }),
    planter: makeSprite(16, PALETTE.planter, (c) => {
```

   with:

```ts
      poly(c, [[-12, -9], [13, 0], [-12, 9], [-6, 0]]);
      line(c, -2, -3, 6, 0);
      line(c, -2, 3, 6, 0);
      c.stroke();
    }),
    planter: makeSprite(16, PALETTE.planter, (c) => {
```

Edit `src/scenes/screens.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  glowText(ctx, 'DROPZONE', VIEW_W / 2, 200, 96, PALETTE.player);
  glowText(ctx, 'RESCUE THE MEN  -  DESTROY THE ALIENS', VIEW_W / 2, 245, 18, PALETTE.hud);
  if (Math.floor(time * 2) % 2 === 0) {
    glowText(ctx, 'PRESS ENTER / SPACE / START', VIEW_W / 2, 310, 22, PALETTE.hunter);
  }

  glowText(ctx, 'HIGH SCORES', VIEW_W / 2, 370, 20, PALETTE.man);
```

   with:

```ts
  glowText(ctx, 'DROPZONE', VIEW_W / 2, 200, 96, PALETTE.player);
  glowText(ctx, 'RESCUE THE MEN  -  DESTROY THE ALIENS', VIEW_W / 2, 245, 18, PALETTE.hud);
  if (Math.floor(time * 2) % 2 === 0) {
    glowText(ctx, 'PRESS ENTER / SPACE / START', VIEW_W / 2, 310, 22, PALETTE.gold);
  }

  glowText(ctx, 'HIGH SCORES', VIEW_W / 2, 370, 20, PALETTE.man);
```

2. Replace:

```ts

export function drawInitials(ctx: CanvasRenderingContext2D, letters: string[], cursor: number, score: number, time: number): void {
  dim(ctx, 0.7);
  glowText(ctx, 'NEW HIGH SCORE', VIEW_W / 2, 220, 56, PALETTE.hunter);
  glowText(ctx, String(score), VIEW_W / 2, 280, 32, PALETTE.text);
  letters.forEach((ch, i) => {
    const x = VIEW_W / 2 + (i - 1) * 80;
```

   with:

```ts

export function drawInitials(ctx: CanvasRenderingContext2D, letters: string[], cursor: number, score: number, time: number): void {
  dim(ctx, 0.7);
  glowText(ctx, 'NEW HIGH SCORE', VIEW_W / 2, 220, 56, PALETTE.gold);
  glowText(ctx, String(score), VIEW_W / 2, 280, 32, PALETTE.text);
  letters.forEach((ch, i) => {
    const x = VIEW_W / 2 + (i - 1) * 80;
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 306 tests pass, no type errors.

- [ ] **Step 5: Smoke check**

Run `npm run dev`, press Enter and play for 30 s: the game runs with no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A src/audio/eventAudio.ts src/game/constants.ts src/game/entities/enemies.ts src/game/events.ts src/game/state.ts src/game/systems/ai/index.ts src/game/systems/combat.ts src/game/systems/rescue.ts src/game/update.ts src/render/debug.ts src/render/effects.ts src/render/hud.ts src/render/palette.ts src/render/renderer.ts src/render/sprites.ts src/scenes/screens.ts tests/audio/eventAudio.test.ts tests/game/entities/enemies.test.ts tests/game/state.test.ts tests/game/systems/ai/index.test.ts tests/game/systems/ai/spawners.test.ts tests/game/systems/combat.test.ts tests/game/systems/powerups.test.ts tests/game/systems/rescue.test.ts tests/game/update.test.ts tests/render/effects.test.ts tests/scenes/demo.test.ts
git commit -m "refactor: remove the Phase 1 Snatcher, Orb, Hunter and trails"
```

---

### Task 12: Scoring, lives, smart bombs and the shield bank

- Kill values already follow `ENEMY_STATS` (combo still applies).
- Losing a life costs 10 points (never below 0).
- Every 10,000 points gives +1 life and +1 smart bomb (bombs capped at `MAX_BOMBS = 9`), up to 1,000,000; after that no awards. The shipment +1 bomb is removed.
- Strata Bomb: kills every enemy on the led screen except Androids in one pass over the enemies alive at detonation (so Trailers released by bombed Spores survive) and clears enemy shots, acid, magma and Nmeye bombs on screen.
- Shield: `player.cloak` (0..1 meter) is removed. The cloak drains `s.shieldBank` by 1 s per second; the bank starts at 7 and `startWave` adds 7 for every wave after the first (no cap). The HUD shows `SHIELD 12.4s` and nine small bomb pips; the extra-life popup reads `EXTRA LIFE + BOMB`.

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/state.ts`
- Modify: `src/game/systems/combat.ts`
- Modify: `src/game/systems/powerups.ts`
- Modify: `src/game/systems/scoring.ts`
- Modify: `src/game/systems/waves.ts`
- Modify: `src/render/effects.ts`
- Modify: `src/render/hud.ts`
- Test (modify): `tests/game/state.test.ts`
- Test (modify): `tests/game/systems/combat.test.ts`
- Test (modify): `tests/game/systems/powerups.test.ts`
- Test (modify): `tests/game/systems/scoring.test.ts`
- Test (modify): `tests/game/systems/waves.test.ts`
- Test (modify): `tests/render/hud.test.ts`

**Interfaces:**
- Consumes: `clearHazardsNear` (Task 3), `killEnemy` (Spore release from Task 7), `s.shieldBank` (Task 2), `startWave` (Task 10).
- Produces:
  - Constants `EXTRA_AWARD_LIMIT = 1_000_000`, `DEATH_PENALTY = 10`, `MAX_BOMBS = 9`, `SHIELD_PER_WAVE = 7`, `SHIELD_DRAIN = 1` (`CLOAK_DRAIN` removed)
  - `Player.cloak` removed
  - `shieldLabel(bank: number): string` exported from `src/render/hud.ts`
  - `updateCloak(s, a, dt)` and `triggerBomb(s): boolean` keep their signatures

- [ ] **Step 1: Write the failing tests**

Edit `tests/game/state.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
    expect(s.player.y).toBeLessThan(groundYAt(s.terrain, s.baseX));
    expect(s.player.alive).toBe(true);
    expect(s.player.facing).toBe(1);
    expect(s.player.cloak).toBe(1);
    expect(s.player.carryingId).toBeNull();
  });
```

   with:

```ts
    expect(s.player.y).toBeLessThan(groundYAt(s.terrain, s.baseX));
    expect(s.player.alive).toBe(true);
    expect(s.player.facing).toBe(1);
    expect(s.player.carryingId).toBeNull();
  });
```

Edit `tests/game/systems/combat.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
    expect(s.player.alive).toBe(true);
  });

  it('losing the last life ends the game', () => {
    const s = createGameState(1);
    s.lives = 1;
```

   with:

```ts
    expect(s.player.alive).toBe(true);
  });

  it('losing a life costs 10 points, never going below 0', () => {
    const s = createGameState(1);
    s.score = 1234;
    killPlayer(s);
    expect(s.score).toBe(1224);
    const t = createGameState(1);
    t.score = 4;
    killPlayer(t);
    expect(t.score).toBe(0);
  });

  it('losing the last life ends the game', () => {
    const s = createGameState(1);
    s.lives = 1;
```

Edit `tests/game/systems/powerups.test.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { createGameState } from '../../../src/game/state';
import { NO_ACTIONS } from '../../../src/core/input';
import { updateCloak, triggerBomb, updateRespawn, RESPAWN_Y } from '../../../src/game/systems/powerups';
import { CLOAK_DRAIN, RESPAWN_DELAY, RESPAWN_INVULN, START_BOMBS, HITSTOP_MULTI } from '../../../src/game/constants';
import { CAMERA_LEAD, WORLD_W, VIEW_W, shortestDx } from '../../../src/core/world';
import { addEnemy } from '../helpers';

const CLOAK = { ...NO_ACTIONS, cloak: true };

describe('updateCloak', () => {
  it('activates while held and drains the meter', () => {
    const s = createGameState(1);
    updateCloak(s, CLOAK, 1);
    expect(s.player.cloakActive).toBe(true);
    expect(s.player.cloak).toBeCloseTo(1 - CLOAK_DRAIN);
    expect(s.events).toContainEqual({ type: 'cloakOn' });
  });
```

   with:

```ts
import { createGameState } from '../../../src/game/state';
import { NO_ACTIONS } from '../../../src/core/input';
import { updateCloak, triggerBomb, updateRespawn, RESPAWN_Y } from '../../../src/game/systems/powerups';
import {
  SHIELD_START, SHIELD_DRAIN, RESPAWN_DELAY, RESPAWN_INVULN, START_BOMBS, HITSTOP_MULTI,
} from '../../../src/game/constants';
import { CAMERA_LEAD, WORLD_W, VIEW_W, shortestDx } from '../../../src/core/world';
import { addEnemy } from '../helpers';

const CLOAK = { ...NO_ACTIONS, cloak: true };

describe('updateCloak (shield bank)', () => {
  it('activates while held and drains 1 s of shield per second', () => {
    const s = createGameState(1);
    expect(s.shieldBank).toBe(SHIELD_START);
    updateCloak(s, CLOAK, 1);
    expect(s.player.cloakActive).toBe(true);
    expect(s.shieldBank).toBeCloseTo(SHIELD_START - SHIELD_DRAIN);
    expect(s.events).toContainEqual({ type: 'cloakOn' });
  });
```

2. Replace:

```ts
    updateCloak(s, CLOAK, 0.1);
    updateCloak(s, NO_ACTIONS, 0.1);
    expect(s.player.cloakActive).toBe(false);
    expect(s.events).toContainEqual({ type: 'cloakOff' });
  });

  it('turns off when the meter is empty', () => {
    const s = createGameState(1);
    s.player.cloak = 0.01;
    updateCloak(s, CLOAK, 1);
    expect(s.player.cloak).toBe(0);
    updateCloak(s, CLOAK, 0.01);
    expect(s.player.cloakActive).toBe(false);
  });
```

   with:

```ts
    updateCloak(s, CLOAK, 0.1);
    updateCloak(s, NO_ACTIONS, 0.1);
    expect(s.player.cloakActive).toBe(false);
    expect(s.shieldBank).toBeCloseTo(SHIELD_START - 0.1);
    expect(s.events).toContainEqual({ type: 'cloakOff' });
  });

  it('turns off when the bank is empty', () => {
    const s = createGameState(1);
    s.shieldBank = 0.01;
    updateCloak(s, CLOAK, 1);
    expect(s.shieldBank).toBe(0);
    updateCloak(s, CLOAK, 0.01);
    expect(s.player.cloakActive).toBe(false);
  });
```

3. Replace:

```ts
    expect(ahead.dead).toBe(true);
    expect(behind.dead).toBe(false);
    expect(CAMERA_LEAD).toBeGreaterThan(0);
  });

  it('does nothing without bombs or while dead', () => {
```

   with:

```ts
    expect(ahead.dead).toBe(true);
    expect(behind.dead).toBe(false);
    expect(CAMERA_LEAD).toBeGreaterThan(0);
  });

  it('spares Androids', () => {
    const s = createGameState(1);
    const android = addEnemy(s, 'android', s.player.x + 200, 600);
    const planter = addEnemy(s, 'planter', s.player.x + 250, 300);
    triggerBomb(s);
    expect(android.dead).toBe(false);
    expect(planter.dead).toBe(true);
  });

  it('Spores killed by the bomb release Trailers that survive the blast', () => {
    const s = createGameState(1);
    addEnemy(s, 'spore', s.player.x + 200, 300);
    triggerBomb(s);
    const alive = s.enemies.filter((e) => !e.dead);
    expect(alive).toHaveLength(4);
    expect(alive.every((e) => e.kind === 'trailer')).toBe(true);
  });

  it('clears acid, magma and Nmeye bombs on screen', () => {
    const s = createGameState(1);
    s.acid.push({ x: s.player.x + 100, y: 300, vy: 220 });
    s.magma.push({ x: s.player.x - 100, y: 300, vx: 0, vy: 0, r: 5, hot: false });
    s.eyeBombs.push({ x: s.player.x, y: 200, vy: 180 });
    s.acid.push({ x: s.player.x + 4000, y: 300, vy: 220 });
    triggerBomb(s);
    expect(s.magma).toHaveLength(0);
    expect(s.eyeBombs).toHaveLength(0);
    expect(s.acid).toHaveLength(1);
  });

  it('does nothing without bombs or while dead', () => {
```

Edit `tests/game/systems/scoring.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import { addScore, registerKill, awardBonus, tickCombo, resetCombo } from '../../../src/game/systems/scoring';
import { COMBO_WINDOW, MAX_MULTIPLIER, EXTRA_LIFE_EVERY, START_LIVES } from '../../../src/game/constants';

describe('scoring', () => {
  it('first kill is x1 and emits a popup', () => {
```

   with:

```ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import { addScore, registerKill, awardBonus, tickCombo, resetCombo } from '../../../src/game/systems/scoring';
import {
  COMBO_WINDOW, MAX_MULTIPLIER, EXTRA_LIFE_EVERY, START_LIVES, START_BOMBS, MAX_BOMBS,
} from '../../../src/game/constants';

describe('scoring', () => {
  it('first kill is x1 and emits a popup', () => {
```

2. Replace:

```ts
    expect(s.multiplier).toBe(2);
  });

  it('awards an extra life every EXTRA_LIFE_EVERY points', () => {
    const s = createGameState(1);
    addScore(s, EXTRA_LIFE_EVERY * 2 + 5);
    expect(s.lives).toBe(START_LIVES + 2);
    expect(s.nextExtraLife).toBe(EXTRA_LIFE_EVERY * 3);
    expect(s.events.filter((e) => e.type === 'extraLife')).toHaveLength(2);
  });
});
```

   with:

```ts
    expect(s.multiplier).toBe(2);
  });

  it('awards an extra life and a smart bomb every 10,000 points', () => {
    const s = createGameState(1);
    expect(EXTRA_LIFE_EVERY).toBe(10000);
    addScore(s, EXTRA_LIFE_EVERY * 2 + 5);
    expect(s.lives).toBe(START_LIVES + 2);
    expect(s.bombs).toBe(START_BOMBS + 2);
    expect(s.nextExtraLife).toBe(EXTRA_LIFE_EVERY * 3);
    expect(s.events.filter((e) => e.type === 'extraLife')).toHaveLength(2);
  });

  it('caps smart bombs at 9', () => {
    const s = createGameState(1);
    expect(MAX_BOMBS).toBe(9);
    s.bombs = 8;
    addScore(s, EXTRA_LIFE_EVERY * 3);
    expect(s.bombs).toBe(9);
    expect(s.lives).toBe(START_LIVES + 3);
  });

  it('stops awarding after 1,000,000 points', () => {
    const s = createGameState(1);
    s.score = 995000;
    s.nextExtraLife = 1000000;
    addScore(s, 5000);
    expect(s.lives).toBe(START_LIVES + 1);
    addScore(s, 50000);
    expect(s.lives).toBe(START_LIVES + 1);
    expect(s.events.filter((e) => e.type === 'extraLife')).toHaveLength(1);
  });
});
```

Edit `tests/game/systems/waves.test.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { registerKill } from '../../../src/game/systems/scoring';
import {
  MEN_PER_WAVE, NMEYE_DELAY, NMEYE_REPEAT, SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME,
  START_BOMBS, MAX_BOMBS,
} from '../../../src/game/constants';
import { shortestDx } from '../../../src/core/world';
import { addMan, addEnemy } from '../helpers';
```

   with:

```ts
import { registerKill } from '../../../src/game/systems/scoring';
import {
  MEN_PER_WAVE, NMEYE_DELAY, NMEYE_REPEAT, SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME,
  START_BOMBS, SHIELD_START, SHIELD_PER_WAVE,
} from '../../../src/game/constants';
import { shortestDx } from '../../../src/core/world';
import { addMan, addEnemy } from '../helpers';
```

2. Replace:

```ts
    const s = createGameState(1);
    s.unstable = true;
    s.savedThisWave = 4;
    s.player.cloak = 0;
    s.shots.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
    startWave(s, 2);
    expect(s.unstable).toBe(false);
    expect(s.savedThisWave).toBe(0);
    expect(s.player.cloak).toBe(1);
    expect(s.shots).toHaveLength(0);
    expect(s.waveTime).toBe(0);
    expect(s.nextNmeyeAt).toBe(NMEYE_DELAY);
```

   with:

```ts
    const s = createGameState(1);
    s.unstable = true;
    s.savedThisWave = 4;
    s.shots.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
    startWave(s, 2);
    expect(s.unstable).toBe(false);
    expect(s.savedThisWave).toBe(0);
    expect(s.shots).toHaveLength(0);
    expect(s.waveTime).toBe(0);
    expect(s.nextNmeyeAt).toBe(NMEYE_DELAY);
```

3. Replace:

```ts
});

describe('shipments', () => {
  it('the wave after an invasion tops the men back up to 8 and gives a bomb', () => {
    const s = createGameState(1);
    s.survivors = 0;
    startWave(s, 6);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
    expect(s.survivors).toBe(MEN_PER_WAVE);
    expect(s.bombs).toBe(START_BOMBS + 1);
    s.bombs = MAX_BOMBS;
    startWave(s, 11);
    expect(s.bombs).toBe(MAX_BOMBS);
  });
});
```

   with:

```ts
});

describe('shipments', () => {
  it('the wave after an invasion tops the men back up to 8 (no bonus bomb any more)', () => {
    const s = createGameState(1);
    s.survivors = 0;
    startWave(s, 6);
    expect(s.men).toHaveLength(MEN_PER_WAVE);
    expect(s.survivors).toBe(MEN_PER_WAVE);
    expect(s.bombs).toBe(START_BOMBS);
  });
});

describe('shield bank', () => {
  it('starts at 7 s and gains 7 s at the start of every later wave, with no cap', () => {
    const s = createGameState(1);
    startWave(s, 1);
    expect(s.shieldBank).toBe(SHIELD_START);
    startWave(s, 2);
    expect(s.shieldBank).toBe(SHIELD_START + SHIELD_PER_WAVE);
    for (let w = 3; w <= 10; w++) startWave(s, w);
    expect(s.shieldBank).toBe(SHIELD_START + 9 * SHIELD_PER_WAVE);
  });
});
```

Edit `tests/render/hud.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { describe, it, expect } from 'vitest';
import { SCANNER, scannerPos, scannerTerrainOffsets } from '../../src/render/hud';
import { WORLD_W, VIEW_H } from '../../src/core/world';
import { CEILING_Y } from '../../src/game/constants';
```

   with:

```ts
import { describe, it, expect } from 'vitest';
import { SCANNER, scannerPos, scannerTerrainOffsets, shieldLabel } from '../../src/render/hud';
import { WORLD_W, VIEW_H } from '../../src/core/world';
import { CEILING_Y } from '../../src/game/constants';
```

2. Append at the end of the file:

```ts

describe('shieldLabel', () => {
  it('shows the shield bank in seconds with one decimal', () => {
    expect(shieldLabel(12.4)).toBe('SHIELD 12.4s');
    expect(shieldLabel(7)).toBe('SHIELD 7.0s');
    expect(shieldLabel(0)).toBe('SHIELD 0.0s');
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/game/state.test.ts tests/game/systems/combat.test.ts tests/game/systems/powerups.test.ts tests/game/systems/scoring.test.ts tests/game/systems/waves.test.ts tests/render/hud.test.ts`
Expected: FAIL: scoring (no bomb awarded, no 1,000,000 limit), combat (no −10), powerups (`CLOAK_DRAIN` gone / Androids killed / Trailers killed), waves (shield not topped up, bomb still given), hud (`shieldLabel` missing).

- [ ] **Step 3: Implement**

Edit `src/game/constants.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts

// Lives, bombs, cloak
export const START_LIVES = 3;
export const EXTRA_LIFE_EVERY = 10000;
export const START_BOMBS = 3;
export const MAX_BOMBS = 5;
/** Cloak meter drained per second while active (meter is 0..1, so 4 s total). */
export const CLOAK_DRAIN = 0.25;
/** Shield (cloak) seconds at the start of a game. */
export const SHIELD_START = 7;
export const RESPAWN_DELAY = 2;
export const RESPAWN_INVULN = 2;
```

   with:

```ts

// Lives, bombs, cloak
export const START_LIVES = 3;
/** Every 10,000 points gives +1 life and +1 smart bomb... */
export const EXTRA_LIFE_EVERY = 10000;
/** ...up to this score, after which there are no more awards. */
export const EXTRA_AWARD_LIMIT = 1_000_000;
/** Points lost per death (the score never goes below 0). */
export const DEATH_PENALTY = 10;
export const START_BOMBS = 3;
export const MAX_BOMBS = 9;
/** Shield (cloak) seconds at the start of a game. */
export const SHIELD_START = 7;
/** Shield seconds added at the start of every wave after the first (no cap). */
export const SHIELD_PER_WAVE = 7;
/** Shield seconds drained per second while the shield is on. */
export const SHIELD_DRAIN = 1;
export const RESPAWN_DELAY = 2;
export const RESPAWN_INVULN = 2;
```

Edit `src/game/state.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  alive: boolean;
  respawnTimer: number;
  invuln: number;
  cloakActive: boolean;
  /** Cloak meter, 0..1. */
  cloak: number;
  /** Laser heat, 0..1. */
  heat: number;
  overheated: boolean;
```

   with:

```ts
  alive: boolean;
  respawnTimer: number;
  invuln: number;
  /** Shield (cloak) on; it drains s.shieldBank. */
  cloakActive: boolean;
  /** Laser heat, 0..1. */
  heat: number;
  overheated: boolean;
```

2. Replace:

```ts
      respawnTimer: 0,
      invuln: 0,
      cloakActive: false,
      cloak: 1,
      heat: 0,
      overheated: false,
      fireCooldown: 0,
```

   with:

```ts
      respawnTimer: 0,
      invuln: 0,
      cloakActive: false,
      heat: 0,
      overheated: false,
      fireCooldown: 0,
```

Edit `src/game/systems/combat.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { registerKill, resetCombo } from './scoring';
import { releaseTrailers, trailerHeadHit } from './ai/spawners';
import {
  HITSTOP_MULTI, HITSTOP_NMEYE, PLAYER_RADIUS, MAN_RADIUS, RESPAWN_DELAY,
} from '../constants';

const SHOT_RADIUS = 3;
```

   with:

```ts
import { registerKill, resetCombo } from './scoring';
import { releaseTrailers, trailerHeadHit } from './ai/spawners';
import {
  HITSTOP_MULTI, HITSTOP_NMEYE, PLAYER_RADIUS, MAN_RADIUS, RESPAWN_DELAY, DEATH_PENALTY,
} from '../constants';

const SHOT_RADIUS = 3;
```

2. Replace:

```ts
    p.carryingId = null;
  }
  resetCombo(s);
  s.lives -= 1;
  emit(s, { type: 'playerDied', x: p.x, y: p.y });
  emit(s, { type: 'explosion', x: p.x, y: p.y, source: 'player', big: true });
```

   with:

```ts
    p.carryingId = null;
  }
  resetCombo(s);
  s.score = Math.max(0, s.score - DEATH_PENALTY);
  s.lives -= 1;
  emit(s, { type: 'playerDied', x: p.x, y: p.y });
  emit(s, { type: 'explosion', x: p.x, y: p.y, source: 'player', big: true });
```

Replace the whole content of `src/game/systems/powerups.ts` with:

```ts
import type { Actions } from '../../core/input';
import { VIEW_W, CAMERA_LEAD, WORLD_W, wrapX, shortestDx } from '../../core/world';
import type { GameState } from '../state';
import { emit } from '../events';
import { killEnemy } from './combat';
import { clearHazardsNear } from './hazards';
import { SHIELD_DRAIN, CEILING_Y, RESPAWN_INVULN, HITSTOP_MULTI } from '../constants';

export const RESPAWN_Y = CEILING_Y + 120;

/** The shield (cloak) is on while held, the player is alive and the bank has seconds left. */
export function updateCloak(s: GameState, a: Actions, dt: number): void {
  const p = s.player;
  const want = a.cloak && p.alive && s.shieldBank > 0;
  if (want !== p.cloakActive) emit(s, { type: want ? 'cloakOn' : 'cloakOff' });
  p.cloakActive = want;
  if (want) s.shieldBank = Math.max(0, s.shieldBank - SHIELD_DRAIN * dt);
}

/**
 * Strata Bomb: kills every enemy on the led screen except Androids, and clears enemy shots,
 * acid, magma and Nmeye bombs there. Trailers released by bombed Spores survive the blast.
 */
export function triggerBomb(s: GameState): boolean {
  const p = s.player;
  if (s.bombs <= 0 || !p.alive) return false;
  s.bombs--;
  const range = VIEW_W / 2;
  const cx = wrapX(p.x + p.facing * CAMERA_LEAD);
  const targets = s.enemies.filter(
    (e) => !e.dead && e.kind !== 'android' && Math.abs(shortestDx(cx, e.x)) <= range + e.radius,
  );
  for (const e of targets) killEnemy(s, e);
  s.shots = s.shots.filter((sh) => Math.abs(shortestDx(cx, sh.x)) > range);
  clearHazardsNear(s, cx, range);
  if (targets.length >= 2) s.hitStop = Math.max(s.hitStop, HITSTOP_MULTI);
  emit(s, { type: 'bombDetonated', x: p.x, y: p.y });
  return true;
}

/** Of 8 evenly spaced candidates, the one furthest from any living enemy (ties: lowest index). */
function pickRespawnX(s: GameState): number {
  let bestX = s.baseX;
  let bestMin = -1;
  for (let i = 0; i < 8; i++) {
    const x = wrapX(s.baseX + (i * WORLD_W) / 8);
    let min = Infinity;
    for (const e of s.enemies) {
      if (e.dead) continue;
      min = Math.min(min, Math.abs(shortestDx(x, e.x)));
    }
    if (min > bestMin) {
      bestMin = min;
      bestX = x;
    }
  }
  return bestX;
}

export function updateRespawn(s: GameState, dt: number): void {
  const p = s.player;
  if (p.alive || s.phase === 'gameOver') return;
  p.respawnTimer -= dt;
  if (p.respawnTimer > 0) return;
  p.x = pickRespawnX(s);
  p.alive = true;
  p.y = RESPAWN_Y;
  p.prevX = p.x;
  p.prevY = p.y;
  p.vx = 0;
  p.vy = 0;
  p.invuln = RESPAWN_INVULN;
  p.heat = 0;
  p.overheated = false;
  s.shots = s.shots.filter((sh) => Math.abs(shortestDx(p.x, sh.x)) > VIEW_W / 2);
  emit(s, { type: 'playerRespawned', x: p.x, y: p.y });
}
```

Edit `src/game/systems/scoring.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import type { GameState } from '../state';
import { emit } from '../events';
import { COMBO_WINDOW, MAX_MULTIPLIER, EXTRA_LIFE_EVERY } from '../constants';

export function addScore(s: GameState, points: number): void {
  s.score += points;
  while (s.score >= s.nextExtraLife) {
    s.lives++;
    s.nextExtraLife += EXTRA_LIFE_EVERY;
    emit(s, { type: 'extraLife' });
  }
```

   with:

```ts
import type { GameState } from '../state';
import { emit } from '../events';
import { COMBO_WINDOW, MAX_MULTIPLIER, EXTRA_LIFE_EVERY, EXTRA_AWARD_LIMIT, MAX_BOMBS } from '../constants';

/** Adds points; every 10,000 (up to 1,000,000) gives +1 life and +1 smart bomb (bombs capped at 9). */
export function addScore(s: GameState, points: number): void {
  s.score += points;
  while (s.score >= s.nextExtraLife && s.nextExtraLife <= EXTRA_AWARD_LIMIT) {
    s.lives++;
    s.bombs = Math.min(MAX_BOMBS, s.bombs + 1);
    s.nextExtraLife += EXTRA_LIFE_EVERY;
    emit(s, { type: 'extraLife' });
  }
```

Edit `src/game/systems/waves.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { addScore } from './scoring';
import { clearHazards } from './hazards';
import {
  CEILING_Y, NMEYE_DELAY, NMEYE_REPEAT, MEN_PER_WAVE, MAX_BOMBS,
  SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME, WAVE_BONUS_PER_MAN, WAVE_BONUS_CAP,
} from '../constants';
```

   with:

```ts
import { addScore } from './scoring';
import { clearHazards } from './hazards';
import {
  CEILING_Y, NMEYE_DELAY, NMEYE_REPEAT, MEN_PER_WAVE, SHIELD_PER_WAVE,
  SPAWN_SAFE_DISTANCE, WAVE_COMPLETE_TIME, WAVE_BONUS_PER_MAN, WAVE_BONUS_CAP,
} from '../constants';
```

2. Replace:

```ts
  s.phase = 'playing';
  s.phaseTimer = 0;

  if (isShipmentWave(wave)) {
    s.survivors = MEN_PER_WAVE;
    s.bombs = Math.min(MAX_BOMBS, s.bombs + 1);
  }

  const t = getWaveTuning(effectiveWave(wave));
  s.speedScale = t.speedScale;
```

   with:

```ts
  s.phase = 'playing';
  s.phaseTimer = 0;

  if (isShipmentWave(wave)) s.survivors = MEN_PER_WAVE;
  // The game starts with SHIELD_START seconds; every later wave adds more (no cap).
  if (wave > 1) s.shieldBank += SHIELD_PER_WAVE;

  const t = getWaveTuning(effectiveWave(wave));
  s.speedScale = t.speedScale;
```

3. Replace:

```ts
  s.lasers = [];
  s.men = [];
  s.player.carryingId = null;
  s.player.cloak = 1;

  const invasion = isInvasionWave(wave);
  // Invasion waves have no men: the survivors wait for the next wave.
```

   with:

```ts
  s.lasers = [];
  s.men = [];
  s.player.carryingId = null;

  const invasion = isInvasionWave(wave);
  // Invasion waves have no men: the survivors wait for the next wave.
```

Edit `src/render/effects.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
          this.popup(e.x, e.y - 20, 'MAN LOST', PALETTE.warn);
          break;
        case 'extraLife':
          this.popup(s.player.x, s.player.y - 40, 'EXTRA LIFE', PALETTE.player);
          break;
        case 'planetUnstable':
          this.addTrauma(0.5);
```

   with:

```ts
          this.popup(e.x, e.y - 20, 'MAN LOST', PALETTE.warn);
          break;
        case 'extraLife':
          this.popup(s.player.x, s.player.y - 40, 'EXTRA LIFE + BOMB', PALETTE.player);
          break;
        case 'planetUnstable':
          this.addTrauma(0.5);
```

Edit `src/render/hud.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  ctx.fillText(`WAVE ${s.wave}`, 150, 66);
}

function drawRightPanel(ctx: CanvasRenderingContext2D, s: GameState): void {
  const x0 = 1056;
  ctx.fillStyle = PALETTE.player;
```

   with:

```ts
  ctx.fillText(`WAVE ${s.wave}`, 150, 66);
}

/** HUD text for the shield bank, e.g. "SHIELD 12.4s". */
export function shieldLabel(bank: number): string {
  return `SHIELD ${bank.toFixed(1)}s`;
}

function drawRightPanel(ctx: CanvasRenderingContext2D, s: GameState): void {
  const x0 = 1056;
  ctx.fillStyle = PALETTE.player;
```

2. Replace:

```ts
  ctx.lineWidth = 1.5;
  for (let i = 0; i < MAX_BOMBS; i++) {
    ctx.beginPath();
    ctx.arc(x0 + 110 + i * 18, 18, 6, 0, Math.PI * 2);
    if (i < s.bombs) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fill();
    }
    ctx.stroke();
  }
  meter(ctx, x0, 46, 200, s.player.cloak, PALETTE.player, 'CLOAK');
  meter(ctx, x0, 66, 200, s.player.heat, s.player.overheated ? PALETTE.warn : PALETTE.trailer, s.player.overheated ? 'OVERHEAT' : 'HEAT');
}
```

   with:

```ts
  ctx.lineWidth = 1.5;
  for (let i = 0; i < MAX_BOMBS; i++) {
    ctx.beginPath();
    ctx.arc(x0 + 110 + i * 11, 18, 4, 0, Math.PI * 2);
    if (i < s.bombs) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fill();
    }
    ctx.stroke();
  }
  ctx.font = '12px monospace';
  ctx.fillStyle = s.player.cloakActive ? PALETTE.player : PALETTE.hud;
  ctx.fillText(shieldLabel(s.shieldBank), x0, 44);
  meter(ctx, x0, 66, 200, s.player.heat, s.player.overheated ? PALETTE.warn : PALETTE.trailer, s.player.overheated ? 'OVERHEAT' : 'HEAT');
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 314 tests pass, no type errors.

- [ ] **Step 5: Browser check**

`npm run dev`: HUD top-right shows `SHIELD 7.0s` counting down while you hold C; the bomb row has 9 pips; bombing a Spore leaves 4 Trailers alive.

- [ ] **Step 6: Commit**

```bash
git add -A src/game/constants.ts src/game/state.ts src/game/systems/combat.ts src/game/systems/powerups.ts src/game/systems/scoring.ts src/game/systems/waves.ts src/render/effects.ts src/render/hud.ts tests/game/state.test.ts tests/game/systems/combat.test.ts tests/game/systems/powerups.test.ts tests/game/systems/scoring.test.ts tests/game/systems/waves.test.ts tests/render/hud.test.ts
git commit -m "feat: original scoring awards, death penalty, Strata Bomb rules and shield bank"
```

---

### Task 13: Presentation: effects, SFX, banners and the credit

- Effects: continuous earthquake shake (trauma never below `EARTHQUAKE_TRAUMA = 0.35`) while `s.unstable`; proton bolt flash + column sparks; invasion flash; "HELP!" popup on `manWhistle`; burst + "SAFE" on `manSelfRescued`; rings for `nemesiteWarning` and `rumble`.
- HUD: `waveBanner(s)` shows `WAVE n` for the first 3 s of a wave, or a blinking `TRAILER INVASION` on invasion waves.
- SFX: `hunter()` is renamed `nmeyeWarning()`; new `whistle`, `nemesiteWarning`, `rumble`, `boltCrack`, `eruption`, `invasion`, `selfRescue`, and `Sfx.setQuake(on)` (a looping low rumble the App turns on while playing an unstable wave). `createEventAudio` gets a third parameter `near(x)` so eruptions, rumbles and bolts only sound near the camera; eruptions are throttled to one per 0.4 s.
- Title credit becomes `BASED ON DROPZONE (1984) BY ARCHER MACLEAN - ARENA GRAPHICS / U.S. GOLD` (with `AN UNOFFICIAL FAN TRIBUTE`).

**Files:**
- Modify: `src/audio/eventAudio.ts`
- Modify: `src/audio/sfx.ts`
- Modify: `src/render/effects.ts`
- Modify: `src/render/hud.ts`
- Modify: `src/scenes/app.ts`
- Modify: `src/scenes/screens.ts`
- Test (modify): `tests/audio/eventAudio.test.ts`
- Test (modify): `tests/render/effects.test.ts`
- Test (modify): `tests/render/hud.test.ts`
- Test (create): `tests/scenes/screens.test.ts`

**Interfaces:**
- Consumes: All new events (Task 2), `isInvasionWave` (Task 10), `s.unstable` (Task 9).
- Produces:
  - `EARTHQUAKE_TRAUMA` exported from `src/render/effects.ts`
  - `BANNER_TIME = 3`, `waveBanner(s: GameState): string | null` in `src/render/hud.ts`
  - `SfxPlayer` methods: `laser, enemyShot, explosion(big), pickup, caught, rescue, manLost, bomb, death, extraLife, klaxon, cloak(on), waveClear, nmeyeWarning, whistle, nemesiteWarning, rumble, boltCrack, eruption, invasion, selfRescue`; `Sfx.setQuake(on: boolean): void`
  - `createEventAudio(sfx: SfxPlayer, now: () => number, near: (x: number) => boolean = () => true)`, `ERUPTION_THROTTLE = 0.4`
  - `ORIGINAL_CREDIT` (new text), `TRIBUTE_NOTE` unchanged

- [ ] **Step 1: Write the failing tests**

Replace the whole content of `tests/audio/eventAudio.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { createEventAudio, LASER_THROTTLE, ERUPTION_THROTTLE } from '../../src/audio/eventAudio';
import type { SfxPlayer } from '../../src/audio/sfx';
import type { GameEvent } from '../../src/game/events';

function fakeSfx() {
  const calls: string[] = [];
  const rec = (name: string) => (arg?: unknown) => calls.push(arg === undefined ? name : `${name}:${String(arg)}`);
  const sfx: SfxPlayer = {
    laser: rec('laser'), enemyShot: rec('enemyShot'), explosion: rec('explosion'), pickup: rec('pickup'),
    caught: rec('caught'), rescue: rec('rescue'), manLost: rec('manLost'), bomb: rec('bomb'), death: rec('death'),
    extraLife: rec('extraLife'), klaxon: rec('klaxon'), cloak: rec('cloak'), waveClear: rec('waveClear'),
    nmeyeWarning: rec('nmeyeWarning'), whistle: rec('whistle'), nemesiteWarning: rec('nemesiteWarning'),
    rumble: rec('rumble'), boltCrack: rec('boltCrack'), eruption: rec('eruption'), invasion: rec('invasion'),
    selfRescue: rec('selfRescue'),
  };
  return { sfx, calls };
}

describe('createEventAudio', () => {
  it('maps game events to sound effects', () => {
    const { sfx, calls } = fakeSfx();
    const play = createEventAudio(sfx, () => 0);
    const events: GameEvent[] = [
      { type: 'explosion', x: 0, y: 0, source: 'spore', big: true },
      { type: 'manPickedUp', x: 0, y: 0 },
      { type: 'manCaught', x: 0, y: 0 },
      { type: 'manRescued', x: 0, y: 0 },
      { type: 'manDied', x: 0, y: 0 },
      { type: 'bombDetonated', x: 0, y: 0 },
      { type: 'playerDied', x: 0, y: 0 },
      { type: 'extraLife' },
      { type: 'planetUnstable' },
      { type: 'cloakOn' },
      { type: 'cloakOff' },
      { type: 'waveCleared', wave: 1, bonus: 0, saved: 0 },
    ];
    play(events);
    expect(calls).toEqual([
      'explosion:true', 'pickup', 'caught', 'rescue', 'manLost', 'bomb', 'death',
      'extraLife', 'klaxon', 'cloak:true', 'cloak:false', 'waveClear',
    ]);
  });

  it('maps the phase 2 events to their new sounds', () => {
    const { sfx, calls } = fakeSfx();
    createEventAudio(sfx, () => 0)([
      { type: 'nmeyeSpawned', x: 0, y: 0 },
      { type: 'manWhistle', x: 0, y: 0 },
      { type: 'manSelfRescued', x: 0, y: 0 },
      { type: 'nemesiteWarning', x: 0, y: 0 },
      { type: 'rumble', x: 0, y: 0 },
      { type: 'protonBolt', x: 0, top: 100, bottom: 600 },
      { type: 'volcanoErupt', x: 0, y: 500, whiteHot: false },
      { type: 'invasionWave', wave: 5 },
    ]);
    expect(calls).toEqual([
      'nmeyeWarning', 'whistle', 'selfRescue', 'nemesiteWarning', 'rumble', 'boltCrack', 'eruption', 'invasion',
    ]);
  });

  it('only plays eruptions, rumbles and bolts that are near the camera', () => {
    const { sfx, calls } = fakeSfx();
    const play = createEventAudio(sfx, () => 0, (x) => x < 1000);
    play([
      { type: 'rumble', x: 5000, y: 0 },
      { type: 'protonBolt', x: 5000, top: 100, bottom: 600 },
      { type: 'volcanoErupt', x: 5000, y: 500, whiteHot: true },
      { type: 'rumble', x: 500, y: 0 },
    ]);
    expect(calls).toEqual(['rumble']);
  });

  it('throttles eruption sounds', () => {
    const { sfx, calls } = fakeSfx();
    let t = 0;
    const play = createEventAudio(sfx, () => t);
    const erupt: GameEvent = { type: 'volcanoErupt', x: 0, y: 500, whiteHot: false };
    play([erupt, erupt]);
    t = ERUPTION_THROTTLE * 1.5;
    play([erupt]);
    expect(calls.filter((c) => c === 'eruption')).toHaveLength(2);
  });

  it('does not play an explosion sound for the player (death covers it)', () => {
    const { sfx, calls } = fakeSfx();
    createEventAudio(sfx, () => 0)([{ type: 'explosion', x: 0, y: 0, source: 'player', big: true }]);
    expect(calls).toEqual([]);
  });

  it('throttles rapid laser sounds', () => {
    const { sfx, calls } = fakeSfx();
    let t = 0;
    const play = createEventAudio(sfx, () => t);
    const laser: GameEvent = { type: 'laserFired', x: 0, y: 0, facing: 1 };
    play([laser, laser]);
    t = LASER_THROTTLE / 2;
    play([laser]);
    t = LASER_THROTTLE * 1.5;
    play([laser]);
    expect(calls.filter((c) => c === 'laser')).toHaveLength(2);
  });
});
```

Edit `tests/render/effects.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { describe, it, expect } from 'vitest';
import { Effects, MAX_PARTICLES } from '../../src/render/effects';
import { createGameState } from '../../src/game/state';
import type { GameEvent } from '../../src/game/events';
```

   with:

```ts
import { describe, it, expect } from 'vitest';
import { Effects, MAX_PARTICLES, EARTHQUAKE_TRAUMA } from '../../src/render/effects';
import { createGameState } from '../../src/game/state';
import type { GameEvent } from '../../src/game/events';
```

2. Append at the end of the file:

```ts

describe('Effects phase 2 events', () => {
  it('the earthquake keeps the screen shaking while the planet is unstable', () => {
    const fx = new Effects();
    const unstable = { ...s, unstable: true, player: { ...s.player, thrusting: false } };
    for (let i = 0; i < 200; i++) fx.update(0.016, unstable);
    expect(fx.trauma).toBeGreaterThanOrEqual(EARTHQUAKE_TRAUMA);
    expect(EARTHQUAKE_TRAUMA).toBeGreaterThanOrEqual(0.35);
    for (let i = 0; i < 200; i++) fx.update(0.016, { ...unstable, unstable: false });
    expect(fx.trauma).toBe(0);
  });

  it('a proton bolt flashes and sparks along its column', () => {
    const fx = new Effects();
    fx.consume([{ type: 'protonBolt', x: 1000, top: 150, bottom: 600 }], s);
    expect(fx.flash).toBeGreaterThan(0);
    expect(fx.activeParticleCount()).toBeGreaterThanOrEqual(20);
  });

  it('a self-rescue bursts in the men colour', () => {
    const fx = new Effects();
    fx.consume([{ type: 'manSelfRescued', x: 1000, y: 600 }], s);
    expect(fx.activeParticleCount()).toBeGreaterThanOrEqual(24);
  });

  it('an invasion wave flashes the screen', () => {
    const fx = new Effects();
    fx.consume([{ type: 'invasionWave', wave: 5 }], s);
    expect(fx.flash).toBeGreaterThan(0);
  });
});
```

Edit `tests/render/hud.test.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { describe, it, expect } from 'vitest';
import { SCANNER, scannerPos, scannerTerrainOffsets, shieldLabel } from '../../src/render/hud';
import { WORLD_W, VIEW_H } from '../../src/core/world';
import { CEILING_Y } from '../../src/game/constants';
```

   with:

```ts
import { describe, it, expect } from 'vitest';
import { SCANNER, scannerPos, scannerTerrainOffsets, shieldLabel, waveBanner, BANNER_TIME } from '../../src/render/hud';
import { createGameState } from '../../src/game/state';
import { WORLD_W, VIEW_H } from '../../src/core/world';
import { CEILING_Y } from '../../src/game/constants';
```

2. Append at the end of the file:

```ts

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
```

Create `tests/scenes/screens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ORIGINAL_CREDIT, TRIBUTE_NOTE } from '../../src/scenes/screens';

describe('title credit', () => {
  it('credits the original game, verbatim', () => {
    expect(ORIGINAL_CREDIT).toBe('BASED ON DROPZONE (1984) BY ARCHER MACLEAN - ARENA GRAPHICS / U.S. GOLD');
    expect(TRIBUTE_NOTE).toBe('AN UNOFFICIAL FAN TRIBUTE');
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/audio/eventAudio.test.ts tests/render/effects.test.ts tests/render/hud.test.ts tests/scenes/screens.test.ts`
Expected: FAIL: `eventAudio.test.ts` (fake SFX lacks the new methods / mappings), `effects.test.ts` (`EARTHQUAKE_TRAUMA` missing), `hud.test.ts` (`waveBanner` missing), `screens.test.ts` (old credit text).

- [ ] **Step 3: Implement**

Edit `src/audio/eventAudio.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts

export const LASER_THROTTLE = 0.05;
export const SHOT_THROTTLE = 0.08;

/** Returns a function that plays the right SFX for a batch of game events. `now` is in seconds. */
export function createEventAudio(sfx: SfxPlayer, now: () => number): (events: readonly GameEvent[]) => void {
  let lastLaser = -Infinity;
  let lastShot = -Infinity;
  return (events) => {
    for (const e of events) {
      switch (e.type) {
```

   with:

```ts

export const LASER_THROTTLE = 0.05;
export const SHOT_THROTTLE = 0.08;
export const ERUPTION_THROTTLE = 0.4;

/**
 * Returns a function that plays the right SFX for a batch of game events. `now` is in seconds.
 * `near(x)` says whether a world x is close enough to the camera to hear local sounds
 * (eruptions, storm rumbles and bolts); it defaults to hearing everything.
 */
export function createEventAudio(
  sfx: SfxPlayer,
  now: () => number,
  near: (x: number) => boolean = () => true,
): (events: readonly GameEvent[]) => void {
  let lastLaser = -Infinity;
  let lastShot = -Infinity;
  let lastEruption = -Infinity;
  return (events) => {
    for (const e of events) {
      switch (e.type) {
```

2. Replace:

```ts
          sfx.waveClear();
          break;
        case 'nmeyeSpawned':
          sfx.hunter();
          break;
        default:
          break;
```

   with:

```ts
          sfx.waveClear();
          break;
        case 'nmeyeSpawned':
          sfx.nmeyeWarning();
          break;
        case 'manWhistle':
          sfx.whistle();
          break;
        case 'manSelfRescued':
          sfx.selfRescue();
          break;
        case 'nemesiteWarning':
          sfx.nemesiteWarning();
          break;
        case 'rumble':
          if (near(e.x)) sfx.rumble();
          break;
        case 'protonBolt':
          if (near(e.x)) sfx.boltCrack();
          break;
        case 'volcanoErupt':
          if (near(e.x) && now() - lastEruption >= ERUPTION_THROTTLE) {
            sfx.eruption();
            lastEruption = now();
          }
          break;
        case 'invasionWave':
          sfx.invasion();
          break;
        default:
          break;
```

Edit `src/audio/sfx.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
  klaxon(): void;
  cloak(on: boolean): void;
  waveClear(): void;
  hunter(): void;
}

export class Sfx implements SfxPlayer {
  constructor(private engine: AudioEngine) {}

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
```

   with:

```ts
  klaxon(): void;
  cloak(on: boolean): void;
  waveClear(): void;
  nmeyeWarning(): void;
  whistle(): void;
  nemesiteWarning(): void;
  rumble(): void;
  boltCrack(): void;
  eruption(): void;
  invasion(): void;
  selfRescue(): void;
}

export class Sfx implements SfxPlayer {
  private quake: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  constructor(private engine: AudioEngine) {}

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
```

2. Replace:

```ts
    src.stop(t + dur + 0.02);
  }

  private arpeggio(freqs: number[], type: OscillatorType, step: number, vol: number): void {
    freqs.forEach((f, i) => this.tone(type, f, f, step * 1.5, vol, i * step));
  }

  laser(): void {
```

   with:

```ts
    src.stop(t + dur + 0.02);
  }

  private arpeggio(freqs: number[], type: OscillatorType, step: number, vol: number, delay = 0): void {
    freqs.forEach((f, i) => this.tone(type, f, f, step * 1.5, vol, delay + i * step));
  }

  laser(): void {
```

3. Replace:

```ts
    this.arpeggio([392, 523, 659, 784, 1047], 'triangle', 0.1, 0.18);
  }

  hunter(): void {
    this.tone('sawtooth', 200, 800, 0.4, 0.07);
    this.tone('sawtooth', 200, 800, 0.4, 0.07, 0.45);
  }
}
```

   with:

```ts
    this.arpeggio([392, 523, 659, 784, 1047], 'triangle', 0.1, 0.18);
  }

  nmeyeWarning(): void {
    this.tone('sawtooth', 200, 800, 0.4, 0.07);
    this.tone('sawtooth', 200, 800, 0.4, 0.07, 0.45);
  }

  /** A man whistling for help: a rising then falling two-note whistle. */
  whistle(): void {
    this.tone('sine', 1800, 2500, 0.12, 0.08);
    this.tone('sine', 2500, 1600, 0.18, 0.08, 0.15);
  }

  nemesiteWarning(): void {
    this.tone('square', 880, 880, 0.07, 0.05);
    this.tone('square', 880, 880, 0.07, 0.05, 0.12);
  }

  rumble(): void {
    this.noise(0.8, 0.3, 320, 60);
  }

  boltCrack(): void {
    this.noise(0.25, 0.6, 6000, 800);
    this.tone('sawtooth', 1200, 100, 0.2, 0.08);
  }

  eruption(): void {
    this.noise(0.5, 0.25, 900, 120);
    this.tone('sine', 90, 40, 0.4, 0.15);
  }

  invasion(): void {
    this.arpeggio([392, 494, 587, 784], 'sawtooth', 0.12, 0.08);
    this.arpeggio([523, 659, 784, 1047], 'sawtooth', 0.12, 0.08, 0.5);
  }

  selfRescue(): void {
    this.arpeggio([1047, 1319, 1568], 'sine', 0.06, 0.12);
  }

  /** Starts or stops the low earthquake rumble loop. Safe to call every frame. */
  setQuake(on: boolean): void {
    const { ctx, sfxBus } = this.engine;
    if (on === (this.quake !== null)) return;
    if (!on) {
      const q = this.quake;
      this.quake = null;
      if (!q || !ctx) return;
      try {
        q.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
        q.src.stop(ctx.currentTime + 1);
      } catch {
        /* already stopped */
      }
      return;
    }
    const buf = this.engine.noiseBuffer();
    if (!ctx || !sfxBus || !buf || !this.engine.ready) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.5);
    src.connect(filter).connect(gain).connect(sfxBus);
    src.start();
    this.quake = { src, gain };
  }
}
```

Edit `src/render/effects.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
const SLOWMO_SCALE = 0.35;
const SHAKE_MAX = 16;
const PARTICLE_GRAVITY = 120;

interface Particle {
  active: boolean;
```

   with:

```ts
const SLOWMO_SCALE = 0.35;
const SHAKE_MAX = 16;
const PARTICLE_GRAVITY = 120;
/** Minimum screen-shake trauma while the planet is unstable (the earthquake). */
export const EARTHQUAKE_TRAUMA = 0.35;

interface Particle {
  active: boolean;
```

2. Replace:

```ts
        case 'laserBlocked':
          this.burst(e.x, e.y, PALETTE.laser, 8, 160);
          break;
        case 'nmeyeSpawned':
          this.ring(e.x, e.y, 90, PALETTE.nmeye, 0.5);
          break;
```

   with:

```ts
        case 'laserBlocked':
          this.burst(e.x, e.y, PALETTE.laser, 8, 160);
          break;
        case 'manWhistle':
          this.popup(e.x, e.y - 26, 'HELP!', PALETTE.warn);
          break;
        case 'manSelfRescued':
          this.burst(e.x, e.y, PALETTE.man, 24, 160);
          this.popup(e.x, e.y - 30, 'SAFE', PALETTE.man);
          break;
        case 'nemesiteWarning':
          this.ring(e.x, e.y, 50, PALETTE.nemesite, 0.4);
          break;
        case 'rumble':
          this.ring(e.x, e.y, 40, PALETTE.blunderstorm, 0.6);
          break;
        case 'protonBolt':
          this._flash = Math.max(this._flash, 0.25);
          this.flashColor = PALETTE.bolt;
          for (let y = e.top; y < e.bottom; y += 18) {
            this.spawn(e.x, y, rand(-120, 120), rand(-40, 40), 0.3, 2, PALETTE.bolt, 3);
          }
          break;
        case 'invasionWave':
          this._flash = Math.max(this._flash, 0.3);
          this.flashColor = PALETTE.trailer;
          break;
        case 'nmeyeSpawned':
          this.ring(e.x, e.y, 90, PALETTE.nmeye, 0.5);
          break;
```

3. Replace:

```ts
    this._trauma = Math.max(0, this._trauma - dt * 1.2);
    this._flash = Math.max(0, this._flash - dt * 2.5);
    this.slowmo = Math.max(0, this.slowmo - dt);
    const simDt = dt * this.timeScale();

    const p = s.player;
```

   with:

```ts
    this._trauma = Math.max(0, this._trauma - dt * 1.2);
    this._flash = Math.max(0, this._flash - dt * 2.5);
    this.slowmo = Math.max(0, this.slowmo - dt);
    if (s.unstable) this._trauma = Math.max(this._trauma, EARTHQUAKE_TRAUMA);
    const simDt = dt * this.timeScale();

    const p = s.player;
```

Edit `src/render/hud.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import type { GameState } from '../game/state';
import { CEILING_Y, COMBO_WINDOW, MAX_BOMBS } from '../game/constants';
import { groundYAt } from '../game/terrain';
import { PALETTE } from './palette';

export const SCANNER = { x: 240, y: 8, w: 800, h: 64 } as const;
```

   with:

```ts
import type { GameState } from '../game/state';
import { CEILING_Y, COMBO_WINDOW, MAX_BOMBS } from '../game/constants';
import { groundYAt } from '../game/terrain';
import { isInvasionWave } from '../game/tuning';
import { PALETTE } from './palette';

export const SCANNER = { x: 240, y: 8, w: 800, h: 64 } as const;
```

2. Replace:

```ts
  meter(ctx, x0, 66, 200, s.player.heat, s.player.overheated ? PALETTE.warn : PALETTE.trailer, s.player.overheated ? 'OVERHEAT' : 'HEAT');
}

function drawCenterMessages(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.textAlign = 'center';
  if (s.unstable && Math.floor(s.time * 3) % 2 === 0) {
    ctx.fillStyle = PALETTE.warn;
    ctx.font = 'bold 20px monospace';
```

   with:

```ts
  meter(ctx, x0, 66, 200, s.player.heat, s.player.overheated ? PALETTE.warn : PALETTE.trailer, s.player.overheated ? 'OVERHEAT' : 'HEAT');
}

/** Seconds the wave-start banner stays up. */
export const BANNER_TIME = 3;

/** Banner shown at the start of a wave: "TRAILER INVASION" for invasions, otherwise "WAVE n". */
export function waveBanner(s: GameState): string | null {
  if (s.phase !== 'playing' || s.waveTime >= BANNER_TIME) return null;
  return isInvasionWave(s.wave) ? 'TRAILER INVASION' : `WAVE ${s.wave}`;
}

function drawCenterMessages(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.textAlign = 'center';
  const banner = waveBanner(s);
  if (banner !== null && (banner.startsWith('WAVE') || Math.floor(s.time * 4) % 2 === 0)) {
    ctx.fillStyle = banner.startsWith('WAVE') ? PALETTE.text : PALETTE.trailer;
    ctx.font = 'bold 36px monospace';
    ctx.fillText(banner, VIEW_W / 2, 260);
  }
  if (s.unstable && Math.floor(s.time * 3) % 2 === 0) {
    ctx.fillStyle = PALETTE.warn;
    ctx.font = 'bold 20px monospace';
```

Edit `src/scenes/app.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { NO_ACTIONS, consumeEdges, type Actions } from '../core/input';
import { clamp, lerpWrapped } from '../core/world';
import type { GameState } from '../game/state';
import { update } from '../game/update';
import { newGame } from '../game/systems/waves';
```

   with:

```ts
import { NO_ACTIONS, consumeEdges, type Actions } from '../core/input';
import { VIEW_W, clamp, lerpWrapped, shortestDx } from '../core/world';
import type { GameState } from '../game/state';
import { update } from '../game/update';
import { newGame } from '../game/systems/waves';
```

2. Replace:

```ts
  private gameOverTimer = 0;
  private audio = new AudioEngine();
  private music = new Music(this.audio);
  private playEvents = createEventAudio(new Sfx(this.audio), () => performance.now() / 1000);

  constructor(
    private renderer: AppRenderer,
```

   with:

```ts
  private gameOverTimer = 0;
  private audio = new AudioEngine();
  private music = new Music(this.audio);
  private sfx = new Sfx(this.audio);
  private playEvents = createEventAudio(
    this.sfx,
    () => performance.now() / 1000,
    (x) => Math.abs(shortestDx(this.camera.x, x)) <= VIEW_W,
  );

  constructor(
    private renderer: AppRenderer,
```

3. Replace:

```ts
      updateCamera(this.camera, lerpWrapped(s.player.prevX, s.player.x, alpha), s.player.facing, frameDt);
    }
    this.music.setIntensity(s.unstable ? 2 : s.wave >= 5 ? 1 : 0);
    this.renderer.render(s, this.camera, alpha, this.fx);
    this.drawScreens();
  }
```

   with:

```ts
      updateCamera(this.camera, lerpWrapped(s.player.prevX, s.player.x, alpha), s.player.facing, frameDt);
    }
    this.music.setIntensity(s.unstable ? 2 : s.wave >= 5 ? 1 : 0);
    this.sfx.setQuake(this._scene === 'playing' && s.unstable);
    this.renderer.render(s, this.camera, alpha, this.fx);
    this.drawScreens();
  }
```

Edit `src/scenes/screens.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
export const INITIAL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';

/** Credit for the original game, shown on the title screen. */
export const ORIGINAL_CREDIT = 'BASED ON DROPZONE (1984) BY ARCHER MACLEAN - ATARI 8-BIT / COMMODORE 64';
export const TRIBUTE_NOTE = 'AN UNOFFICIAL FAN TRIBUTE';

const CONTROLS = [
```

   with:

```ts
export const INITIAL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';

/** Credit for the original game, shown on the title screen. */
export const ORIGINAL_CREDIT = 'BASED ON DROPZONE (1984) BY ARCHER MACLEAN - ARENA GRAPHICS / U.S. GOLD';
export const TRIBUTE_NOTE = 'AN UNOFFICIAL FAN TRIBUTE';

const CONTROLS = [
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 324 tests pass, no type errors.

- [ ] **Step 5: Browser check**

`npm run dev`: title shows the new credit; wave starts show `WAVE n`; wave 5 shows a blinking `TRAILER INVASION` with a fanfare; men whistle and show "HELP!" when targeted; a man reaching the base shows "SAFE" with a chime; storms rumble then crack; let all men die: red sky, constant shake and a low rumble loop.

- [ ] **Step 6: Commit**

```bash
git add -A src/audio/eventAudio.ts src/audio/sfx.ts src/render/effects.ts src/render/hud.ts src/scenes/app.ts src/scenes/screens.ts tests/audio/eventAudio.test.ts tests/render/effects.test.ts tests/render/hud.test.ts tests/scenes/screens.test.ts
git commit -m "feat: effects, sounds, banners and credit for the original roster"
```

---

### Task 14: Integration: update ordering, simulation, browser checklist, tuning pass

Final review of the tick order (documented in `update.ts`), hazards keep moving during the wave-complete pause, extra integration and simulation tests (the new roster shows up in 90 s of scripted play; wave 6 is reached with a shipment, shield bank 42 and bonuses), a richer debug overlay, then the browser E2E checklist and a tuning pass.

**Files:**
- Modify: `src/game/update.ts`
- Modify: `src/render/debug.ts`
- Test (modify): `tests/game/sim.test.ts`
- Test (modify): `tests/game/update.test.ts`

**Interfaces:**
- Consumes: Everything above.
- Produces:
  - No new public APIs. `update(s, a, dt)` unchanged in signature.

- [ ] **Step 1: Write the failing tests**

Edit `tests/game/sim.test.ts` (3 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { NO_ACTIONS, type Actions } from '../../src/core/input';
import { update } from '../../src/game/update';
import { newGame } from '../../src/game/systems/waves';
import { SIM_DT, MEN_PER_WAVE } from '../../src/game/constants';
import type { GameState } from '../../src/game/state';

/** Deterministic scripted pilot: sweeps back and forth, bobs, fires constantly, bombs and cloaks periodically. */
```

   with:

```ts
import { NO_ACTIONS, type Actions } from '../../src/core/input';
import { update } from '../../src/game/update';
import { newGame } from '../../src/game/systems/waves';
import { SIM_DT, MEN_PER_WAVE, SHIELD_START, SHIELD_PER_WAVE } from '../../src/game/constants';
import type { GameState } from '../../src/game/state';

/** Deterministic scripted pilot: sweeps back and forth, bobs, fires constantly, bombs and cloaks periodically. */
```

2. Replace:

```ts
  });
});

describe('wave progression', () => {
  it('reaches wave 6 with a fresh shipment of men even after the planet went unstable', () => {
    const s = newGame(42);
```

   with:

```ts
  });
});

describe('phase 2 roster in scripted play', () => {
  it('volcanoes, planters, nemesites and the nmeye all show up in 90 s', () => {
    const s = newGame(1234);
    s.lives = 99;
    const seen = new Set<string>();
    for (let i = 0; i < Math.round(90 / SIM_DT); i++) {
      update(s, scriptedActions(i), SIM_DT);
      for (const e of s.events) seen.add(e.type);
      s.events.length = 0;
    }
    for (const t of ['volcanoErupt', 'manWhistle', 'nemesiteWarning', 'nmeyeSpawned', 'bombDetonated']) {
      expect(seen.has(t)).toBe(true);
    }
  });
});

describe('wave progression', () => {
  it('reaches wave 6 with a fresh shipment of men even after the planet went unstable', () => {
    const s = newGame(42);
```

3. Replace:

```ts
    expect(menAtStart[4]).toBe(0); // planet went unstable in wave 3
    expect(menAtStart[5]).toBe(0); // invasion wave
    expect(s.men).toHaveLength(MEN_PER_WAVE); // shipment
  });
});
```

   with:

```ts
    expect(menAtStart[4]).toBe(0); // planet went unstable in wave 3
    expect(menAtStart[5]).toBe(0); // invasion wave
    expect(s.men).toHaveLength(MEN_PER_WAVE); // shipment
    expect(s.shieldBank).toBe(SHIELD_START + 5 * SHIELD_PER_WAVE);
    expect(s.score).toBeGreaterThan(0); // end-of-wave bonuses
  });
});
```

Edit `tests/game/update.test.ts` (1 change; each *Replace* block matches the current file exactly once):

1. Append at the end of the file:

```ts

describe('update between waves', () => {
  it('hazards keep moving during the wave-complete pause but cannot hurt the player', () => {
    const s = createGameState(1);
    s.phase = 'waveComplete';
    s.phaseTimer = 3;
    s.magma.push({ x: s.player.x, y: s.player.y - 40, vx: 0, vy: 200, r: 5, hot: false });
    const y0 = s.magma[0].y;
    for (let i = 0; i < 30; i++) update(s, NO_ACTIONS, SIM_DT);
    expect(s.player.alive).toBe(true);
    expect(s.magma.length === 0 || s.magma[0].y > y0).toBe(true);
  });
});

describe('planet unstable through update', () => {
  it('losing every man turns Planters into Antimatter and the volcanoes white-hot', () => {
    const s = createGameState(1);
    s.player.invuln = 999;
    addMan(s, 3000, 'dead');
    const planter = addEnemy(s, 'planter', 5000, 300);
    planter.fireTimer = Infinity;
    update(s, NO_ACTIONS, SIM_DT);
    expect(s.unstable).toBe(true);
    expect(planter.kind).toBe('antimatter');
    expect(s.events.some((e) => e.type === 'planetUnstable')).toBe(true);
    for (let t = 0; t < 2; t += SIM_DT) update(s, NO_ACTIONS, SIM_DT);
    expect(s.magma.some((m) => m.hot)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/game/sim.test.ts tests/game/update.test.ts`
Expected: FAIL: "hazards keep moving during the wave-complete pause" (magma frozen between waves). The other new tests already pass; they lock in integrated behaviour.

- [ ] **Step 3: Implement**

Edit `src/game/update.ts` (2 changes; each *Replace* block matches the current file exactly once):

1. Replace:

```ts
import { updateHazards, resolveHazardHits } from './systems/hazards';
import { updateVolcanoes } from './systems/volcanoes';

export function update(s: GameState, a: Actions, dt: number): void {
  if (s.phase === 'gameOver') return;
  if (s.hitStop > 0) {
```

   with:

```ts
import { updateHazards, resolveHazardHits } from './systems/hazards';
import { updateVolcanoes } from './systems/volcanoes';

/**
 * One fixed simulation tick. Order matters:
 * 1. player (timers, respawn, flight, shield)
 * 2. player weapons (bomb, firing, lasers)
 * 3. world movers (enemies + their shots, volcanoes, hazards, men)
 * 4. collisions (lasers -> enemies, enemies/shots -> player, hazards -> player)
 * 5. rules (planet unstable, combo decay, Nmeye timer), then cleanup and the wave-end check.
 */
export function update(s: GameState, a: Actions, dt: number): void {
  if (s.phase === 'gameOver') return;
  if (s.hitStop > 0) {
```

2. Replace:

```ts
  updateCloak(s, a, dt);

  if (s.phase === 'waveComplete') {
    updateMen(s, dt);
    updateLasers(s, dt);
    updateWavePhase(s, dt);
    return;
  }
```

   with:

```ts
  updateCloak(s, a, dt);

  if (s.phase === 'waveComplete') {
    // Nothing can hurt the player between waves, but anything already in flight finishes its arc.
    updateMen(s, dt);
    updateLasers(s, dt);
    updateHazards(s, dt);
    updateWavePhase(s, dt);
    return;
  }
```

Replace the whole content of `src/render/debug.ts` with:

```ts
import { VIEW_W, SCANNER_H, toScreenX } from '../core/world';
import type { GameState } from '../game/state';
import { MAN_RADIUS, PLAYER_RADIUS } from '../game/constants';

const DEBUG_COLOR = '#7cfc00';

export function drawDebug(ctx: CanvasRenderingContext2D, s: GameState, camX: number, fps: number, particles: number): void {
  const aliveMen = s.men.filter((m) => m.state !== 'dead' && m.state !== 'saved').length;
  const lines = [
    `FPS ${fps.toFixed(0)}`,
    `SEED ${s.seed}`,
    `WAVE ${s.wave}  T ${s.waveTime.toFixed(1)}`,
    `ENEMIES ${s.enemies.length}`,
    `SHOTS ${s.shots.length}  HAZARDS ${s.magma.length + s.acid.length + s.bolts.length + s.eyeBombs.length}`,
    `MEN ${aliveMen}/${s.men.length}  SAVED ${s.savedThisWave}  NEXT ${s.survivors}`,
    `SHIELD ${s.shieldBank.toFixed(1)}  BOMBS ${s.bombs}`,
    `PARTICLES ${particles}`,
    `MULT x${s.multiplier}  UNSTABLE ${s.unstable}`,
  ];
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = DEBUG_COLOR;
  lines.forEach((l, i) => ctx.fillText(l, 12, SCANNER_H + 20 + i * 15));

  ctx.strokeStyle = DEBUG_COLOR;
  ctx.lineWidth = 1;
  const circle = (x: number, y: number, r: number) => {
    const sx = toScreenX(x, camX);
    if (sx < -50 || sx > VIEW_W + 50) return;
    ctx.beginPath();
    ctx.arc(sx, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  for (const e of s.enemies) circle(e.x, e.y, e.radius);
  for (const m of s.men) if (m.state !== 'dead' && m.state !== 'saved') circle(m.x, m.y, MAN_RADIUS);
  if (s.player.alive) circle(s.player.x, s.player.y, PLAYER_RADIUS * 0.8);
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all 327 tests pass, no type errors.

- [ ] **Step 5: Smoke check**

Run `npm run dev`, press Enter and play for 30 s: the game runs with no console errors.

- [ ] **Step 5b: Commit**

```bash
git add src/game/update.ts src/render/debug.ts tests/game/sim.test.ts tests/game/update.test.ts
git commit -m "test: integrate phase 2 systems, extend the simulation tests and debug overlay"
```

- [ ] **Step 6: Browser E2E checklist**

Run `npm run dev`, open the printed URL, and check each item (F3 toggles the debug overlay, which now shows `SAVED`, `NEXT` (survivors), `SHIELD`, `BOMBS` and `HAZARDS`):

1. Title: attract demo runs; credit line reads exactly `BASED ON DROPZONE (1984) BY ARCHER MACLEAN - ARENA GRAPHICS / U.S. GOLD` and `AN UNOFFICIAL FAN TRIBUTE` below it.
2. Wave 1: banner `WAVE 1`; 5 Planters and 1 Spore on the scanner, no Blunderstorm; 8 men walking toward the base (white cross on the scanner).
3. A Planter over a man hovers, a tether line grows down, the man shows a blinking "!" and whistles; shoot the Planter mid-lowering: the Android falls and shooting it pops `+500`.
4. A landed Android chases its man; the man dies on contact (`MAN LOST`); the Planter has become a red Nemesite.
5. A man walking into the lake or a lava pool turns back; one reaching the pad disappears with `SAFE` and no score; carrying one onto the pad in wave 1 scores 100.
6. Shoot a Trailer from behind: a spark, it survives; head-on: it dies.
7. Shoot a Spore: 4 Trailers burst out diagonally.
8. Wave 3+: a Blunderstorm near the top drops 5 green acid drops, or rumbles then fires a white bolt to the ground 0.8 s later; both kill you, neither hurts men.
9. After 60 s in a wave: an Nmeye flashes in, zig-zags faster than you can fly and drops bombs; it reappears every 20 s.
10. Let every man die: `PLANET UNSTABLE`, red sky, continuous shake and rumble, Planters/Androids become spinning white Antimatter, volcanoes throw large white-hot rocks every 1–1.8 s.
11. Wave 5: blinking `TRAILER INVASION`, only Trailers + 2 Spores, no men; wave 6: 8 men again.
12. HUD: `SHIELD 7.0s` drains while cloaked and is 14.0s at wave 2 start (if unused); 9 bomb pips; dying costs 10 points; passing 10,000 gives a life and a bomb (`EXTRA LIFE + BOMB`).
13. Smart bomb: all on-screen enemies die except Androids; acid/magma/bombs on screen vanish.
14. No console errors for a full wave; F3 shows HAZARDS staying under ~100.

- [ ] **Step 7: Tuning pass**

Play waves 1–6 twice. Adjust only these constants, and only if the stated symptom appears; re-run `npm test && npm run typecheck` after any change (tests reference the constants, not literal values, except the spec-mandated ones that must not change: Planter rise 120, tether 120 px/s, Android 1.6×, Nemesite 260/2/s/140 px/s/0.35 s/250/640, Spore 50, Nmeye 760/0.6 s/60 s/20 s, Antimatter 80/3/160, storm 3–5 s/5 drops/220/0.8 s/12 px/0.25 s, volcano numbers, lake/ditch/volcano geometry):

| Symptom | Constant (file) | Direction |
|---|---|---|
| Wave 1 men are all lost before the player can react | `WAVE_TABLE[0].planters` (`tuning.ts`) | 5 → 4 |
| Waves feel empty after the Planters convert | `WAVE_TABLE` spores column | +1 in waves 2–4 |
| Enemy shots too dense in waves 8–10 | `WAVE_TABLE` fireInterval column | +0.2 each |
| Men self-rescue too often (less carrying) | `SPAWN_BASE_CLEAR` (`rescue.ts`) | 200 → 400 |
| Planters over volcanoes never reach men | none (spec-mandated); note it in the PR instead | — |

If no symptom appears, change nothing. Commit any change separately:

```bash
git add src/game/tuning.ts src/game/systems/rescue.ts
git commit -m "chore: tune phase 2 wave composition after playtesting"
```

---

## Self-Review (for the plan author; executors can skip)

Spec coverage, section by section (every rule has at least one test in the listed task):

| Spec item | Task(s) | Test(s) |
|---|---|---|
| Decisions: keep modern extras, combo on top of original values | 2, 5, 12 | combat "500 then ×2", rescue/waves multiplier tests |
| Decisions: self-rescue no points, carrying earns bonus | 9 | rescue "rescues himself: survivor, no points", "100 x wave" |
| Decisions: controls unchanged | all (no input changes) | existing `tests/core/input.test.ts` untouched |
| Decisions: credit text verbatim | 13 | `tests/scenes/screens.test.ts` |
| §1 roster `EnemyKind` exactly the eight kinds | 2 (additive), 11 (final) | enemies "only the eight original kinds exist" |
| §1 Planter drift 220–380, rise 120 over volcano/base | 2, 5 | enemies cruise test; planter "rises 120 … volcano / base" |
| §1 Planter lowers Android at ≤40 px, not on chased men, tether 120 px/s | 5 | planter "hovers and lowers…", "ignores…", "grows the tether…" |
| §1 Planter → Nemesite when Android lands/dies/released | 5 | planter "converts … once its Android lands"; combat "killing a lowering Android…" |
| §1 Android chase at 1.6×, kills man, then wanders | 5 | planter "chases…", "kills the man on contact and then wanders" |
| §1 Falling Android 500 points, dies on ground | 5 | combat "worth 500"; planter "a falling Android dies…" |
| §1 Nemesite speed 260, turn 2/s, dodge ±140 for 0.35 s beyond 250 px, warning at 640 | 2, 6 | homers dodge/commit/ignore/warn tests |
| §1 Spore speed 50, bounces, never attacks, 4 Trailers at 90° on any kill | 2, 7, 12 | spawners spore tests; powerups "Spores killed by the bomb…" |
| §1 Trailer weave without trail, 50% homers (1.5/s), head-hit rule | 2, 7 | enemies homer ratio; spawners trailer + head-hit tests |
| §1 Blunderstorm band, 3–5 s, 5 acid @220, rumble → 0.8 s bolt 12 px 0.25 s | 2, 8, 3 | storm tests; hazards bolt column/expiry |
| §1 Nmeye 60 s then 20 s, speed 760 > 720, heading 0.4–0.9 s, bomb 0.6 s @180, flashes | 6, 10 | waves "nmeye timer"; homers nmeye tests (flash is render-only, browser checklist 9) |
| §1 Antimatter only on unstable; radius 80, 3 rad/s, centre drifts 160 px/s | 6, 9 | homers antimatter tests; rescue "goes unstable … Antimatter" |
| §1 Fire multipliers (Planter 2, Nemesite 0.6, Nmeye 0, Trailer 1.5, others 0) | 2 | enemies "uses the spec fire multipliers" |
| §2 5 volcanoes ≥1200 apart, ≥600 from base, cone 90 × 260 | 1 | landscape placement + cone tests |
| §2 Magma normal mode numbers, lethal to player, harmless to men, despawn on ground | 3, 4 | volcanoes normal test; hazards magma tests |
| §2 Lake 360 px ≥1500 from base, flat; men turn at edges | 1, 9 | landscape lake tests; rescue "turn back at the lake edge" |
| §2 Lava ditches 64 × 30; fall death; walking men turn | 1, 9 | landscape ditch test; rescue lava fall + lava turn tests |
| §2 4 craters; queries; `groundYAt` includes features | 1 | landscape tests |
| §2 Base white cross on scanner | 1 | browser check (render-only) |
| §3 Walk to base by shortest wrapped direction; reverse 1–2 s at obstacles | 9 | rescue walking tests |
| §3 Self-rescue on pad, survivor, 0 pts, event | 9 | rescue self-rescue test |
| §3 Delivery 100 × wave, cap 500, × combo, survivor | 9 | rescue delivery tests |
| §3 Whistle + "!" when targeted | 5, 13 | planter `manWhistle` assertion; eventAudio whistle mapping |
| §3 Fall death above `MAN_SAFE_FALL` or into lava | 9 | rescue falling tests |
| §4 Unstable trigger, Planters/Androids → Antimatter | 9 | rescue checkUnstable tests; update "planet unstable through update" |
| §4 Earthquake: trauma ≥0.35, rumble, `planetUnstable` replaces `planetCritical` | 9, 13 | effects earthquake test; eventAudio klaxon mapping |
| §4 Volcano white-hot mode (1–1.8 s, 2–3 rocks, r 8, vy −480..−340) | 4 | volcanoes white-hot tests; update test sees hot magma |
| §4 Red sky stays until wave end | 9 (rename), 10 (`startWave` resets) | waves "resets per-wave state" |
| §5 Waves 1–99 then 95–99 cycle, displayed number keeps counting | 10 | tuning numbering tests; waves "wave 100 plays as 95" |
| §5 Wave-end rule (no enemies AND no unresolved men; `chased` unresolved) | 10 | waves wave-clear tests |
| §5 Survivors re-deployed, dead men gone | 10 | waves "deploys only the survivors", "survivors carry over" |
| §5 Invasion waves: 6 + wave/5 Trailers + 2 Spores, no men, banner + event | 10, 13 | waves invasion tests; hud `waveBanner` test |
| §5 Shipments reset to 8 | 10 | waves shipments test; sim wave progression |
| §5 0 men after unstable until shipment | 10 | waves "a wave after the planet went unstable has no men"; sim wave progression |
| §5 Nmeye timer replaces Hunter timer | 6 | waves nmeye timer |
| §5 Composition table 1–10 + formula; no storms in waves 1–2 | 10 | tuning tests; waves "waves 1 and 2 have no Blunderstorms" |
| §5 End-of-wave bonus capped 500/man × multiplier, shown on WAVE COMPLETE | 10 | waves bonus tests (HUD already shows `lastWaveBonus`) |
| §6 Kill points × combo | 2, 5 | enemies point values; combat tests |
| §6 −10 per death, floor 0 | 12 | combat "losing a life costs 10 points" |
| §6 +life +bomb every 10,000, bombs ≤9, until 1,000,000 | 12 | scoring tests |
| §6 Strata Bomb spares Androids, Spore Trailers survive, clears shots/acid/magma/bombs | 12 | powerups bomb tests |
| §6 Shield bank 7, +7/wave, no cap, 1/s, HUD `SHIELD 12.4s` | 2, 12 | powerups shield tests; waves shield test; hud `shieldLabel` |
| §7 Sprites, landscape rendering, effects, SFX | 1–4, 6, 7, 13 | palette test; effects/eventAudio tests; browser checklist |
| §8 Architecture (files, fields, hazard lists, AI split) | 1–11 | file map above |
| §9 Simulation reaches wave 6 clearing enemies and resolving men | 10, 14 | `tests/game/sim.test.ts` |

Task sizing: the switch-over was split into Task 10 (spawning/waves, additive) and Task 11 (deletions) so each stays reviewable and green.

Placeholder scan: no TBD/TODO; every code step contains the complete code or an exact replacement verified against the scratch clone.

Type consistency: names used across tasks were cross-checked: `eyeBombs`/`EyeBomb`, `shieldBank`, `survivors`, `unstable`/`checkUnstable`, `nextNmeyeAt`, `NMEYE_DELAY`/`NMEYE_REPEAT`, `killPoints`, `startOrbit`, `releaseTrailers`, `trailerHeadHit`, `clearHazards`/`clearHazardsNear`, `effectiveWave`/`isInvasionWave`/`isShipmentWave`/`getInvasionTuning`, `waveBonusPerMan`, `rescuePoints`, `shieldLabel`, `waveBanner`, `EARTHQUAKE_TRAUMA`, `Sfx.setQuake`.
