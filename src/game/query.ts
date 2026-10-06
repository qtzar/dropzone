import type { GameState, Man, Enemy } from './state';

export function findMan(s: GameState, id: number): Man | undefined {
  return s.men.find((m) => m.id === id);
}

export function findEnemy(s: GameState, id: number): Enemy | undefined {
  return s.enemies.find((e) => e.id === id && !e.dead);
}
