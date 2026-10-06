import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import { NO_ACTIONS } from '../../../src/core/input';
import { updateFiring, updateLasers, LASER_MUZZLE_OFFSET } from '../../../src/game/systems/weapons';
import {
  SIM_DT, FIRE_INTERVAL, HEAT_PER_SHOT, LASER_LIFE, LASER_SPEED, OVERHEAT_UNLOCK,
} from '../../../src/game/constants';

const FIRE = { ...NO_ACTIONS, fire: true };

describe('updateFiring', () => {
  it('fires a laser in the facing direction and emits laserFired', () => {
    const s = createGameState(1);
    s.player.facing = -1;
    updateFiring(s, FIRE, SIM_DT);
    expect(s.lasers).toHaveLength(1);
    expect(s.lasers[0].vx).toBeLessThan(-LASER_SPEED + 1);
    expect(s.lasers[0].x).toBeCloseTo(s.player.x - LASER_MUZZLE_OFFSET);
    expect(s.player.heat).toBeCloseTo(HEAT_PER_SHOT);
    expect(s.events[0]).toMatchObject({ type: 'laserFired', facing: -1 });
  });

  it('respects the fire interval', () => {
    const s = createGameState(1);
    updateFiring(s, FIRE, SIM_DT);
    updateFiring(s, FIRE, SIM_DT);
    expect(s.lasers).toHaveLength(1);
    for (let t = 0; t < FIRE_INTERVAL; t += SIM_DT) updateFiring(s, FIRE, SIM_DT);
    expect(s.lasers).toHaveLength(2);
  });

  it('overheats and locks firing until cooled below the unlock threshold', () => {
    const s = createGameState(1);
    s.player.heat = 0.99;
    updateFiring(s, FIRE, SIM_DT);
    expect(s.player.overheated).toBe(true);
    const count = s.lasers.length;
    s.player.fireCooldown = 0;
    updateFiring(s, FIRE, SIM_DT);
    expect(s.lasers.length).toBe(count);
    s.player.heat = OVERHEAT_UNLOCK - 0.01;
    updateFiring(s, NO_ACTIONS, SIM_DT);
    expect(s.player.overheated).toBe(false);
  });

  it('cools down when not firing', () => {
    const s = createGameState(1);
    s.player.heat = 0.5;
    updateFiring(s, NO_ACTIONS, 0.5);
    expect(s.player.heat).toBeLessThan(0.5);
  });

  it('does not fire while dead', () => {
    const s = createGameState(1);
    s.player.alive = false;
    updateFiring(s, FIRE, SIM_DT);
    expect(s.lasers).toHaveLength(0);
  });
});

describe('updateLasers', () => {
  it('moves lasers, records prevX and removes expired ones', () => {
    const s = createGameState(1);
    s.lasers.push({ x: 100, prevX: 100, y: 200, vx: 1200, life: LASER_LIFE });
    updateLasers(s, 0.1);
    expect(s.lasers[0].prevX).toBe(100);
    expect(s.lasers[0].x).toBeCloseTo(220);
    updateLasers(s, LASER_LIFE);
    expect(s.lasers).toHaveLength(0);
  });
});
