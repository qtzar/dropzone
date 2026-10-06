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
