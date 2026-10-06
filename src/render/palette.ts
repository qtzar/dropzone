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
