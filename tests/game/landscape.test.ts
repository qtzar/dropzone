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
