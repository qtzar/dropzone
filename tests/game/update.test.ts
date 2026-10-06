import { describe, it, expect } from 'vitest';
import { createGameState } from '../../src/game/state';
import { NO_ACTIONS } from '../../src/core/input';
import { update } from '../../src/game/update';
import { SIM_DT } from '../../src/game/constants';

describe('update', () => {
  it('advances time and moves the player', () => {
    const s = createGameState(1);
    const x = s.player.x;
    update(s, { ...NO_ACTIONS, moveX: 1 }, SIM_DT);
    expect(s.time).toBeCloseTo(SIM_DT);
    expect(s.player.x).toBeGreaterThan(x);
  });
});
