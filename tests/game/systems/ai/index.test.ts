import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../../src/game/state';
import { updateEnemies, updateShots } from '../../../../src/game/systems/ai';
import { SIM_DT, CEILING_Y } from '../../../../src/game/constants';
import { WORLD_W } from '../../../../src/core/world';
import { addEnemy } from '../../helpers';

function tick(s: ReturnType<typeof createGameState>, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

describe('homing enemies', () => {
  it('nemesite homes toward the player across the seam', () => {
    const s = createGameState(1);
    s.player.x = 50;
    s.player.y = 300;
    const e = addEnemy(s, 'nemesite', WORLD_W - 200, 300);
    e.fireTimer = Infinity;
    tick(s, 1);
    expect(e.vx).toBeGreaterThan(0);
  });

  it('ignores a cloaked player', () => {
    const s = createGameState(1);
    s.player.cloakActive = true;
    const e = addEnemy(s, 'nemesite', s.player.x + 200, s.player.y);
    e.fireTimer = 0.001;
    tick(s, 0.1);
    expect(s.shots).toHaveLength(0);
  });
});

describe('enemy fire', () => {
  it('fires an aimed shot when the timer elapses and the player is in range', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nemesite', s.player.x + 300, s.player.y);
    e.fireTimer = 0.001;
    updateEnemies(s, SIM_DT);
    expect(s.shots).toHaveLength(1);
    expect(s.shots[0].vx).toBeLessThan(0);
    expect(s.events.some((ev) => ev.type === 'enemyShot')).toBe(true);
    expect(e.fireTimer).toBeGreaterThan(0);
  });

  it('does not fire at a player out of range', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nemesite', s.player.x + 3000, s.player.y);
    e.fireTimer = 0.001;
    updateEnemies(s, SIM_DT);
    expect(s.shots).toHaveLength(0);
  });
});

describe('integration', () => {
  it('a spore bounces off the ceiling', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'spore', 3000, CEILING_Y + 1);
    e.vy = -200;
    tick(s, 0.1);
    expect(e.vy).toBeGreaterThan(0);
  });

  it('skips dead enemies', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'spore', 3000, 300);
    e.dead = true;
    tick(s, 0.5);
    expect(e.x).toBe(3000);
  });
});

describe('updateShots', () => {
  it('moves shots and removes expired ones', () => {
    const s = createGameState(1);
    s.shots.push({ x: 1000, y: 300, vx: 100, vy: 0, life: 0.05 });
    updateShots(s, 0.01);
    expect(s.shots[0].x).toBeCloseTo(1001);
    updateShots(s, 0.1);
    expect(s.shots).toHaveLength(0);
  });

  it('removes shots that hit the ground', () => {
    const s = createGameState(1);
    s.shots.push({ x: 1000, y: 700, vx: 0, vy: 100, life: 2 });
    updateShots(s, 0.01);
    expect(s.shots).toHaveLength(0);
  });
});
