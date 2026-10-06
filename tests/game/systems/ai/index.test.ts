import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../../src/game/state';
import { updateEnemies, updateShots, updateTrails } from '../../../../src/game/systems/ai';
import { SIM_DT, CEILING_Y, SNATCH_CARRY_OFFSET, TRAIL_LIFE, SNATCH_GRACE } from '../../../../src/game/constants';
import { WORLD_W } from '../../../../src/core/world';
import { addMan, addEnemy } from '../../helpers';

function tick(s: ReturnType<typeof createGameState>, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

describe('snatcher', () => {
  it('seeks and grabs a walking man', () => {
    const s = createGameState(1);
    s.waveTime = SNATCH_GRACE;
    const m = addMan(s, 3000);
    const e = addEnemy(s, 'snatcher', 3040, m.y - SNATCH_CARRY_OFFSET - 60);
    e.fireTimer = Infinity;
    tick(s, 3);
    expect(m.state).toBe('snatched');
    expect(m.holderId).toBe(e.id);
    expect(e.carryingId).toBe(m.id);
    expect(s.events.some((ev) => ev.type === 'manSnatched')).toBe(true);
  });

  it('does not target a man during the grace period', () => {
    const s = createGameState(1);
    s.waveTime = 0;
    const m = addMan(s, 3000);
    const e = addEnemy(s, 'snatcher', 3040, m.y - SNATCH_CARRY_OFFSET - 60);
    e.fireTimer = Infinity;
    tick(s, 3);
    expect(m.state).toBe('walking');
    expect(e.targetId).toBeNull();
  });

  it('caps concurrent abductors at 1 + wave', () => {
    const s = createGameState(1);
    s.wave = 1;
    s.waveTime = SNATCH_GRACE;
    const sn = [3000, 4000, 5000].map((x) => {
      const m = addMan(s, x);
      const e = addEnemy(s, 'snatcher', x + 20, m.y - SNATCH_CARRY_OFFSET - 60);
      e.fireTimer = Infinity;
      return e;
    });
    tick(s, 0.5);
    const busy = sn.filter((e) => e.targetId !== null || e.carryingId !== null);
    expect(busy).toHaveLength(2);
  });

  it('kills the man and becomes a nemesite on reaching the top', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'snatched');
    const e = addEnemy(s, 'snatcher', 3000, CEILING_Y + 30);
    e.fireTimer = Infinity;
    m.holderId = e.id;
    e.carryingId = m.id;
    tick(s, 2);
    expect(m.state).toBe('dead');
    expect(e.kind).toBe('nemesite');
    expect(s.events.some((ev) => ev.type === 'manDied')).toBe(true);
  });

  it('wanders when no men are available', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'snatcher', 3000, 300);
    tick(s, 1);
    expect(e.targetId).toBeNull();
    expect(Number.isFinite(e.x)).toBe(true);
  });
});

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

describe('drifters and trailers', () => {
  it('orb bounces off the ceiling', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'orb', 3000, CEILING_Y + 1);
    e.vy = -200;
    tick(s, 0.1);
    expect(e.vy).toBeGreaterThan(0);
  });

  it('trailer leaves trail segments', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 3000, 300);
    e.fireTimer = Infinity;
    tick(s, 0.5);
    expect(s.trails.length).toBeGreaterThan(3);
  });
});

describe('updateShots / updateTrails', () => {
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

  it('decays and removes trail segments', () => {
    const s = createGameState(1);
    s.trails.push({ x: 0, y: 300, life: TRAIL_LIFE });
    updateTrails(s, TRAIL_LIFE + 0.01);
    expect(s.trails).toHaveLength(0);
  });
});
