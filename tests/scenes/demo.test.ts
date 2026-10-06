import { describe, it, expect } from 'vitest';
import { createGameState } from '../../src/game/state';
import { demoActions } from '../../src/scenes/demo';
import { addEnemy } from '../game/helpers';

describe('demoActions', () => {
  it('idles when there are no enemies', () => {
    const s = createGameState(1);
    const a = demoActions(s);
    expect(a.fire).toBe(false);
  });

  it('fires at a level enemy it is facing within range', () => {
    const s = createGameState(1);
    s.player.facing = 1;
    addEnemy(s, 'snatcher', s.player.x + 280, s.player.y + 5);
    const a = demoActions(s);
    expect(a.fire).toBe(true);
    expect(a.moveX).toBeGreaterThanOrEqual(0);
  });

  it('flies toward a distant enemy', () => {
    const s = createGameState(1);
    addEnemy(s, 'snatcher', s.player.x - 2000, s.player.y);
    expect(demoActions(s).moveX).toBe(-1);
  });

  it('climbs or dives to line up with the enemy', () => {
    const s = createGameState(1);
    addEnemy(s, 'snatcher', s.player.x + 400, s.player.y - 200);
    expect(demoActions(s).moveY).toBeLessThan(0);
  });

  it('does nothing while dead', () => {
    const s = createGameState(1);
    s.player.alive = false;
    addEnemy(s, 'snatcher', s.player.x + 280, s.player.y);
    const a = demoActions(s);
    expect(a.fire).toBe(false);
    expect(a.moveX).toBe(0);
  });
});
