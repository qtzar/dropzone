import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import { addScore, registerKill, awardBonus, tickCombo, resetCombo } from '../../../src/game/systems/scoring';
import {
  COMBO_WINDOW, MAX_MULTIPLIER, EXTRA_LIFE_EVERY, START_LIVES, START_BOMBS, MAX_BOMBS,
} from '../../../src/game/constants';

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

  it('awards an extra life and a smart bomb every 10,000 points', () => {
    const s = createGameState(1);
    expect(EXTRA_LIFE_EVERY).toBe(10000);
    addScore(s, EXTRA_LIFE_EVERY * 2 + 5);
    expect(s.lives).toBe(START_LIVES + 2);
    expect(s.bombs).toBe(START_BOMBS + 2);
    expect(s.nextExtraLife).toBe(EXTRA_LIFE_EVERY * 3);
    expect(s.events.filter((e) => e.type === 'extraLife')).toHaveLength(2);
  });

  it('caps smart bombs at 9', () => {
    const s = createGameState(1);
    expect(MAX_BOMBS).toBe(9);
    s.bombs = 8;
    addScore(s, EXTRA_LIFE_EVERY * 3);
    expect(s.bombs).toBe(9);
    expect(s.lives).toBe(START_LIVES + 3);
  });

  it('stops awarding after 1,000,000 points', () => {
    const s = createGameState(1);
    s.score = 995000;
    s.nextExtraLife = 1000000;
    addScore(s, 5000);
    expect(s.lives).toBe(START_LIVES + 1);
    addScore(s, 50000);
    expect(s.lives).toBe(START_LIVES + 1);
    expect(s.events.filter((e) => e.type === 'extraLife')).toHaveLength(1);
  });
});
