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
