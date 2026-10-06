import type { Actions } from '../core/input';
import type { GameState } from './state';
import { updatePlayerMovement, updatePlayerTimers } from './systems/player';

export function update(s: GameState, a: Actions, dt: number): void {
  s.time += dt;
  updatePlayerTimers(s, dt);
  updatePlayerMovement(s, a, dt);
}
