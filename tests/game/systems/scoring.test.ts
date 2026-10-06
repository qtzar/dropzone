import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import { addScore, registerKill, awardBonus, tickCombo, resetCombo } from '../../../src/game/systems/scoring';
import { COMBO_WINDOW, MAX_MULTIPLIER, EXTRA_LIFE_EVERY, START_LIVES } from '../../../src/game/constants';

describe('scoring', () => {
  it('first kill is x1 and emits a popup', () => {
    const s = createGameState(1);
    expect(registerKill(s, 150, 10, 20)).toBe(150);
    expect(s.score).toBe(150);
    expect(s.multiplier).toBe(1);
    expect(s.events).toContainEqual({ type: 'scorePopup', x: 10, y: 20, points: 150, multiplier: 1 });
  });

  it('chained kills within the window raise the multiplier', () => {
    const s = createGameState(1);
    registerKill(s, 100, 0, 0);
    tickCombo(s, COMBO_WINDOW / 2);
    expect(registerKill(s, 100, 0, 0)).toBe(200);
    expect(s.multiplier).toBe(2);
  });

  it('multiplier is capped', () => {
    const s = createGameState(1);
    for (let i = 0; i < 20; i++) registerKill(s, 10, 0, 0);
    expect(s.multiplier).toBe(MAX_MULTIPLIER);
  });

  it('combo resets when the window lapses', () => {
    const s = createGameState(1);
    registerKill(s, 100, 0, 0);
    registerKill(s, 100, 0, 0);
    tickCombo(s, COMBO_WINDOW + 0.01);
    expect(s.multiplier).toBe(1);
    expect(registerKill(s, 100, 0, 0)).toBe(100);
  });

  it('resetCombo drops to x1', () => {
    const s = createGameState(1);
    registerKill(s, 100, 0, 0);
    registerKill(s, 100, 0, 0);
    resetCombo(s);
    expect(s.multiplier).toBe(1);
    expect(s.comboTimer).toBe(0);
  });

  it('awardBonus uses but does not bump the multiplier', () => {
    const s = createGameState(1);
    registerKill(s, 0, 0, 0);
    registerKill(s, 0, 0, 0);
    expect(awardBonus(s, 500, 0, 0)).toBe(1000);
    expect(s.multiplier).toBe(2);
  });

  it('awards an extra life every EXTRA_LIFE_EVERY points', () => {
    const s = createGameState(1);
    addScore(s, EXTRA_LIFE_EVERY * 2 + 5);
    expect(s.lives).toBe(START_LIVES + 2);
    expect(s.nextExtraLife).toBe(EXTRA_LIFE_EVERY * 3);
    expect(s.events.filter((e) => e.type === 'extraLife')).toHaveLength(2);
  });
});
