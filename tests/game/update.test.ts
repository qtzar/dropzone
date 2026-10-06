import { describe, it, expect } from 'vitest';
import { createGameState } from '../../src/game/state';
import { NO_ACTIONS } from '../../src/core/input';
import { update } from '../../src/game/update';
import { newGame } from '../../src/game/systems/waves';
import { SIM_DT, RESCUE_POINTS, PLAYER_RADIUS } from '../../src/game/constants';
import { BASE_GROUND_Y } from '../../src/game/terrain';
import { addMan, addEnemy } from './helpers';

describe('update', () => {
  it('advances time and moves the player', () => {
    const s = createGameState(1);
    addEnemy(s, 'orb', 6000, 300); // keep the wave from clearing
    const x = s.player.x;
    update(s, { ...NO_ACTIONS, moveX: 1 }, SIM_DT);
    expect(s.time).toBeCloseTo(SIM_DT);
    expect(s.player.x).toBeGreaterThan(x);
  });

  it('freezes during hit-stop', () => {
    const s = createGameState(1);
    s.hitStop = 0.05;
    const x = s.player.x;
    update(s, { ...NO_ACTIONS, moveX: 1 }, SIM_DT);
    expect(s.time).toBe(0);
    expect(s.player.x).toBe(x);
    expect(s.hitStop).toBeCloseTo(0.05 - SIM_DT);
  });

  it('snaps previous position to current during hit-stop (no interpolation jitter)', () => {
    const s = createGameState(1);
    s.hitStop = 0.05;
    s.player.prevX = s.player.x - 10;
    s.player.prevY = s.player.y - 10;
    update(s, NO_ACTIONS, SIM_DT);
    expect(s.player.prevX).toBe(s.player.x);
    expect(s.player.prevY).toBe(s.player.y);
  });

  it('does nothing after game over', () => {
    const s = createGameState(1);
    s.phase = 'gameOver';
    update(s, NO_ACTIONS, SIM_DT);
    expect(s.time).toBe(0);
  });

  it('shooting an enemy in front of the player kills it through the full pipeline', () => {
    const s = createGameState(1);
    addEnemy(s, 'orb', 6000, 300); // keep the wave from clearing
    const target = addEnemy(s, 'snatcher', s.player.x + 250, s.player.y);
    target.fireTimer = Infinity;
    target.speed = 0;
    for (let i = 0; i < 30; i++) update(s, { ...NO_ACTIONS, fire: true }, SIM_DT);
    expect(s.enemies.includes(target)).toBe(false);
    expect(s.score).toBeGreaterThan(0);
  });

  it('delivering a man through update scores the rescue', () => {
    const s = createGameState(1);
    addEnemy(s, 'orb', 6000, 300);
    const m = addMan(s, s.baseX, 'carried');
    s.player.carryingId = m.id;
    s.player.y = BASE_GROUND_Y - PLAYER_RADIUS;
    update(s, NO_ACTIONS, SIM_DT);
    expect(m.state).toBe('saved');
    expect(s.score).toBe(RESCUE_POINTS);
  });

  it('a cleared wave advances to the next wave', () => {
    const s = newGame(5);
    s.enemies = [];
    update(s, NO_ACTIONS, SIM_DT);
    expect(s.phase).toBe('waveComplete');
    for (let t = 0; t < 4; t += SIM_DT) update(s, NO_ACTIONS, SIM_DT);
    expect(s.phase).toBe('playing');
    expect(s.wave).toBe(2);
  });
});

describe('update hazards', () => {
  it('moves hazards and lets them kill the player', () => {
    const s = createGameState(1);
    addEnemy(s, 'orb', 6000, 300);
    s.acid.push({ x: s.player.x, y: s.player.y - 30, vy: 220 });
    for (let i = 0; i < 30 && s.player.alive; i++) update(s, NO_ACTIONS, SIM_DT);
    expect(s.player.alive).toBe(false);
    expect(s.acid).toHaveLength(0);
  });
});
