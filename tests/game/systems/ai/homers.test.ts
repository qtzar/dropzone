import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../../src/game/state';
import { updateEnemies } from '../../../../src/game/systems/ai';
import { shortestDx } from '../../../../src/core/world';
import {
  SIM_DT, NEMESITE_DODGE_SPEED, NEMESITE_DODGE_TIME, NMEYE_BOMB_INTERVAL, EYE_BOMB_SPEED, PLAYER_MAX_VX,
  ANTIMATTER_ORBIT_RADIUS, ANTIMATTER_DRIFT, ANTIMATTER_SPIN,
} from '../../../../src/game/constants';
import { addEnemy } from '../../helpers';

function tick(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

function nemesite(s: GameState, dx: number, dy = 0) {
  const e = addEnemy(s, 'nemesite', s.player.x + dx, s.player.y + dy);
  e.fireTimer = Infinity;
  return e;
}

function laser(s: GameState, x: number, y: number, vx: number) {
  s.lasers.push({ x, prevX: x, y, vx, life: 0.4 });
}

describe('nemesite dodge', () => {
  it('jinks vertically away from a laser heading toward it from more than 250 px', () => {
    const s = createGameState(1);
    const e = nemesite(s, 600);
    laser(s, s.player.x + 20, e.y + 10, 2200);
    const y0 = e.y;
    updateEnemies(s, SIM_DT);
    expect(e.dodgeTimer).toBeCloseTo(NEMESITE_DODGE_TIME);
    expect(e.vy).toBe(-NEMESITE_DODGE_SPEED);
    s.lasers = [];
    tick(s, 0.3);
    expect(e.vy).toBe(-NEMESITE_DODGE_SPEED);
    expect(e.y).toBeLessThan(y0 - 40);
    tick(s, 0.1);
    expect(e.dodgeTimer).toBe(0);
  });

  it('commits (no dodge) once the laser is within 250 px', () => {
    const s = createGameState(1);
    const e = nemesite(s, 600);
    laser(s, e.x - 200, e.y, 2200);
    updateEnemies(s, SIM_DT);
    expect(e.dodgeTimer).toBe(0);
  });

  it('ignores lasers flying away from it or outside the 40 px band', () => {
    const s = createGameState(1);
    const e = nemesite(s, 600);
    laser(s, e.x - 400, e.y, -2200);
    laser(s, e.x - 400, e.y + 60, 2200);
    updateEnemies(s, SIM_DT);
    expect(e.dodgeTimer).toBe(0);
  });

  it('homes toward the player when not dodging', () => {
    const s = createGameState(1);
    const e = nemesite(s, 600);
    tick(s, 1);
    expect(e.vx).toBeLessThan(0);
  });

  it('warns once when it first comes within 640 px of the player', () => {
    const s = createGameState(1);
    nemesite(s, 700);
    updateEnemies(s, SIM_DT);
    expect(s.events.some((ev) => ev.type === 'nemesiteWarning')).toBe(false);
    tick(s, 2);
    expect(s.events.filter((ev) => ev.type === 'nemesiteWarning')).toHaveLength(1);
  });
});

describe('nmeye', () => {
  it('is faster than the player and heads roughly toward them', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nmeye', s.player.x + 1000, s.player.y);
    updateEnemies(s, SIM_DT);
    expect(e.speed).toBeGreaterThan(PLAYER_MAX_VX);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(e.speed);
    expect(e.vx).toBeLessThan(0);
    expect(e.actionTimer).toBeGreaterThanOrEqual(0.4 - SIM_DT);
    expect(e.actionTimer).toBeLessThanOrEqual(0.9);
  });

  it('picks a new heading every 0.4-0.9 s', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nmeye', s.player.x + 3000, 300);
    updateEnemies(s, SIM_DT);
    let changes = 0;
    let last = Math.atan2(e.vy, e.vx);
    for (let t = 0; t < 4; t += SIM_DT) {
      updateEnemies(s, SIM_DT);
      const h = Math.atan2(e.vy, e.vx);
      if (Math.abs(h - last) > 1e-9) changes++;
      last = h;
    }
    expect(changes).toBeGreaterThanOrEqual(4);
    expect(changes).toBeLessThanOrEqual(11);
  });

  it('drops a bomb every 0.6 s', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'nmeye', s.player.x + 3000, 300);
    tick(s, NMEYE_BOMB_INTERVAL * 2 + 0.05);
    expect(s.eyeBombs).toHaveLength(2);
    expect(s.eyeBombs[0].vy).toBe(EYE_BOMB_SPEED);
    expect(e.fireTimer).toBe(Infinity);
    expect(s.shots).toHaveLength(0);
  });
});

describe('antimatter', () => {
  it('circles its centre at radius 80 and 3 rad/s', () => {
    const s = createGameState(1);
    s.player.cloakActive = true; // centre stays put
    const e = addEnemy(s, 'antimatter', 3000, 300);
    const cx = e.orbitX;
    tick(s, 0.5);
    expect(Math.hypot(shortestDx(cx, e.x), e.y - 300)).toBeCloseTo(ANTIMATTER_ORBIT_RADIUS, 0);
    expect(e.orbitAngle).toBeCloseTo(ANTIMATTER_SPIN * 0.5, 1);
    expect(e.orbitX).toBe(cx);
  });

  it('its orbit centre drifts toward the player at 160 px/s', () => {
    const s = createGameState(1);
    s.player.y = 300;
    const e = addEnemy(s, 'antimatter', s.player.x + 1500, 300);
    const cx = e.orbitX;
    tick(s, 1);
    expect(shortestDx(e.orbitX, cx)).toBeCloseTo(ANTIMATTER_DRIFT, -1);
  });
});
