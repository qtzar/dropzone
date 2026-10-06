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
