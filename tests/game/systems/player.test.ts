import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import { NO_ACTIONS } from '../../../src/core/input';
import { updatePlayerMovement, updatePlayerTimers } from '../../../src/game/systems/player';
import {
  SIM_DT, PLAYER_MAX_VX, PLAYER_MAX_VY, PLAYER_RADIUS, CEILING_Y,
} from '../../../src/game/constants';
import { groundYAt } from '../../../src/game/terrain';
import { WORLD_W } from '../../../src/core/world';

function run(s: ReturnType<typeof createGameState>, actions: typeof NO_ACTIONS, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updatePlayerMovement(s, actions, SIM_DT);
}

describe('updatePlayerMovement', () => {
  it('thrusting right accelerates right and faces right', () => {
    const s = createGameState(1);
    s.player.facing = -1;
    updatePlayerMovement(s, { ...NO_ACTIONS, moveX: 1 }, SIM_DT);
    expect(s.player.vx).toBeGreaterThan(0);
    expect(s.player.facing).toBe(1);
    expect(s.player.thrusting).toBe(true);
  });

  it('thrusting left faces left', () => {
    const s = createGameState(1);
    updatePlayerMovement(s, { ...NO_ACTIONS, moveX: -1 }, SIM_DT);
    expect(s.player.facing).toBe(-1);
  });

  it('drag slows the player when not thrusting', () => {
    const s = createGameState(1);
    s.player.vx = 500;
    run(s, NO_ACTIONS, 1);
    expect(Math.abs(s.player.vx)).toBeLessThan(50);
  });

  it('caps speed', () => {
    const s = createGameState(1);
    run(s, { ...NO_ACTIONS, moveX: 1, moveY: -1 }, 2);
    expect(Math.abs(s.player.vx)).toBeLessThanOrEqual(PLAYER_MAX_VX);
    expect(Math.abs(s.player.vy)).toBeLessThanOrEqual(PLAYER_MAX_VY);
  });

  it('gravity pulls the player down to the ground but not through it', () => {
    const s = createGameState(1);
    run(s, NO_ACTIONS, 10);
    const floor = groundYAt(s.terrain, s.player.x) - PLAYER_RADIUS;
    expect(s.player.y).toBeCloseTo(floor, 0);
    expect(s.player.vy).toBe(0);
  });

  it('cannot fly above the ceiling', () => {
    const s = createGameState(1);
    run(s, { ...NO_ACTIONS, moveY: -1 }, 3);
    expect(s.player.y).toBe(CEILING_Y);
  });

  it('wraps around the world horizontally', () => {
    const s = createGameState(1);
    s.player.x = WORLD_W - 1;
    s.player.vx = 600;
    updatePlayerMovement(s, NO_ACTIONS, SIM_DT);
    expect(s.player.x).toBeLessThan(10);
    expect(s.player.prevX).toBe(WORLD_W - 1);
  });

  it('does nothing while dead', () => {
    const s = createGameState(1);
    s.player.alive = false;
    const x = s.player.x;
    updatePlayerMovement(s, { ...NO_ACTIONS, moveX: 1 }, SIM_DT);
    expect(s.player.x).toBe(x);
  });
});

describe('updatePlayerTimers', () => {
  it('counts down invulnerability to zero', () => {
    const s = createGameState(1);
    s.player.invuln = 0.01;
    updatePlayerTimers(s, 0.1);
    expect(s.player.invuln).toBe(0);
  });
});
