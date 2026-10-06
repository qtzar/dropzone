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
