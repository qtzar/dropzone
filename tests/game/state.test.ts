import { describe, it, expect } from 'vitest';
import { createGameState, allocId } from '../../src/game/state';
import { START_LIVES, START_BOMBS, EXTRA_LIFE_EVERY, MEN_PER_WAVE } from '../../src/game/constants';
import { groundYAt } from '../../src/game/terrain';

describe('createGameState', () => {
  it('creates a fresh game with starting resources', () => {
    const s = createGameState(123);
    expect(s.seed).toBe(123);
    expect(s.lives).toBe(START_LIVES);
    expect(s.bombs).toBe(START_BOMBS);
    expect(s.nextExtraLife).toBe(EXTRA_LIFE_EVERY);
    expect(s.score).toBe(0);
    expect(s.multiplier).toBe(1);
    expect(s.menRemaining).toBe(MEN_PER_WAVE);
    expect(s.phase).toBe('playing');
    expect(s.enemies).toEqual([]);
    expect(s.men).toEqual([]);
    expect(s.events).toEqual([]);
  });

  it('places the player above the base, alive and facing right', () => {
    const s = createGameState(1);
    expect(s.player.x).toBe(s.baseX);
    expect(s.player.y).toBeLessThan(groundYAt(s.terrain, s.baseX));
    expect(s.player.alive).toBe(true);
    expect(s.player.facing).toBe(1);
    expect(s.player.cloak).toBe(1);
    expect(s.player.carryingId).toBeNull();
  });

  it('allocId returns unique increasing ids', () => {
    const s = createGameState(1);
    const a = allocId(s);
    const b = allocId(s);
    expect(b).toBe(a + 1);
  });
});
