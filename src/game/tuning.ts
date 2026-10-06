export interface WaveTuning {
  snatchers: number;
  nemesites: number;
  trailers: number;
  orbs: number;
  speedScale: number;
  /** Base seconds between shots for a shooting enemy (scaled per enemy kind). */
  fireInterval: number;
}

const t = (snatchers: number, nemesites: number, trailers: number, orbs: number, speedScale: number, fireInterval: number): WaveTuning =>
  ({ snatchers, nemesites, trailers, orbs, speedScale, fireInterval });

export const WAVE_TABLE: readonly WaveTuning[] = [
  t(6, 0, 0, 2, 1.0, 4.0),
  t(7, 1, 1, 2, 1.05, 3.6),
  t(8, 1, 2, 3, 1.1, 3.3),
  t(8, 2, 2, 3, 1.15, 3.0),
  t(9, 2, 3, 4, 1.2, 2.8),
  t(10, 3, 3, 4, 1.25, 2.6),
  t(10, 3, 4, 5, 1.3, 2.4),
  t(11, 4, 4, 5, 1.35, 2.2),
  t(12, 4, 5, 6, 1.4, 2.0),
  t(12, 5, 5, 6, 1.45, 1.8),
];

export function getWaveTuning(wave: number): WaveTuning {
  const w = Math.max(1, Math.floor(wave));
  if (w <= WAVE_TABLE.length) return WAVE_TABLE[w - 1];
  const last = WAVE_TABLE[WAVE_TABLE.length - 1];
  const extra = w - WAVE_TABLE.length;
  return {
    snatchers: last.snatchers + Math.floor(extra / 2),
    nemesites: last.nemesites + Math.floor(extra / 3),
    trailers: last.trailers + Math.floor(extra / 2),
    orbs: last.orbs + Math.floor(extra / 3),
    speedScale: Math.min(2, last.speedScale + extra * 0.03),
    fireInterval: Math.max(0.9, last.fireInterval - extra * 0.05),
  };
}
