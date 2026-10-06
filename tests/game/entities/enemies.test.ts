import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import {
  ENEMY_STATS, createEnemy, fireInterval, convertEnemy, makeAggressive, AGGRESSIVE_SPEED_MULT,
} from '../../../src/game/entities/enemies';
import {
  PLANTER_CRUISE_MIN, PLANTER_CRUISE_MAX, STORM_BAND_TOP, STORM_BAND_BOTTOM, NMEYE_BOMB_INTERVAL, ANTIMATTER_ORBIT_RADIUS,
} from '../../../src/game/constants';

describe('enemies', () => {
  it('createEnemy applies stats and the wave speed scale', () => {
    const s = createGameState(1);
    s.speedScale = 1.5;
    const e = createEnemy(s, 'nemesite', 100, 200);
    expect(e.radius).toBe(ENEMY_STATS.nemesite.radius);
    expect(e.speed).toBeCloseTo(ENEMY_STATS.nemesite.speed * 1.5);
    expect(e.dead).toBe(false);
    expect(Number.isFinite(e.fireTimer)).toBe(true);
    expect(s.enemies).toHaveLength(0);
  });

  it('orbs and fragments never fire', () => {
    const s = createGameState(1);
    expect(createEnemy(s, 'orb', 0, 200).fireTimer).toBe(Infinity);
    expect(fireInterval(s, createEnemy(s, 'fragment', 0, 200))).toBe(Infinity);
  });

  it('orbs and trailers start moving', () => {
    const s = createGameState(1);
    const orb = createEnemy(s, 'orb', 0, 200);
    expect(Math.hypot(orb.vx, orb.vy)).toBeGreaterThan(0);
    expect(Math.abs(createEnemy(s, 'trailer', 0, 200).vx)).toBeGreaterThan(0);
  });

  it('convertEnemy changes kind and stats and clears snatcher state', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'snatcher', 0, 200);
    e.carryingId = 5;
    e.targetId = 6;
    convertEnemy(s, e, 'nemesite');
    expect(e.kind).toBe('nemesite');
    expect(e.radius).toBe(ENEMY_STATS.nemesite.radius);
    expect(e.carryingId).toBeNull();
    expect(e.targetId).toBeNull();
  });

  it('makeAggressive turns non-hunters into fast nemesites', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'orb', 0, 200);
    makeAggressive(s, e);
    expect(e.kind).toBe('nemesite');
    expect(e.aggressive).toBe(true);
    expect(e.speed).toBeCloseTo(ENEMY_STATS.nemesite.speed * AGGRESSIVE_SPEED_MULT);
    const h = createEnemy(s, 'hunter', 0, 200);
    makeAggressive(s, h);
    expect(h.kind).toBe('hunter');
    expect(h.speed).toBeCloseTo(ENEMY_STATS.hunter.speed * AGGRESSIVE_SPEED_MULT);
  });
});

describe('phase 2 roster stats', () => {
  it('matches the original point values', () => {
    expect(ENEMY_STATS.planter.points).toBe(250);
    expect(ENEMY_STATS.android.points).toBe(50);
    expect(ENEMY_STATS.nemesite.points).toBe(150);
    expect(ENEMY_STATS.spore.points).toBe(750);
    expect(ENEMY_STATS.trailer.points).toBe(250);
    expect(ENEMY_STATS.blunderstorm.points).toBe(250);
    expect(ENEMY_STATS.nmeye.points).toBe(100);
    expect(ENEMY_STATS.antimatter.points).toBe(150);
  });

  it('uses the spec speeds', () => {
    expect(ENEMY_STATS.nemesite.speed).toBe(260);
    expect(ENEMY_STATS.spore.speed).toBe(50);
    expect(ENEMY_STATS.nmeye.speed).toBe(760);
    expect(ENEMY_STATS.antimatter.speed).toBe(160);
  });

  it('uses the spec fire multipliers', () => {
    expect(ENEMY_STATS.planter.fireMult).toBe(2);
    expect(ENEMY_STATS.nemesite.fireMult).toBe(0.6);
    expect(ENEMY_STATS.trailer.fireMult).toBe(1.5);
    for (const k of ['android', 'spore', 'blunderstorm', 'nmeye', 'antimatter'] as const) {
      expect(ENEMY_STATS[k].fireMult).toBe(0);
    }
  });
});

describe('createEnemy phase 2 defaults', () => {
  it('fills the new fields with neutral defaults', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'android', 100, 500);
    expect(e.linkedId).toBeNull();
    expect(e.tetherLen).toBe(0);
    expect(e.dodgeTimer).toBe(0);
    expect(e.warned).toBe(false);
    expect(e.homer).toBe(false);
    expect(e.falling).toBe(false);
    expect(e.boltTimer).toBe(0);
    expect(e.fireTimer).toBe(Infinity);
  });

  it('planters cruise between 220 and 380 and drift horizontally', () => {
    const s = createGameState(1);
    for (let i = 0; i < 20; i++) {
      const e = createEnemy(s, 'planter', 100, 150);
      expect(e.homeY).toBeGreaterThanOrEqual(PLANTER_CRUISE_MIN);
      expect(e.homeY).toBeLessThanOrEqual(PLANTER_CRUISE_MAX);
      expect(e.y).toBe(e.homeY);
      expect(Math.abs(e.vx)).toBeCloseTo(e.speed);
    }
  });

  it('blunderstorms start in the upper band with a 3-5 s action timer', () => {
    const s = createGameState(1);
    for (let i = 0; i < 20; i++) {
      const e = createEnemy(s, 'blunderstorm', 100, 400);
      expect(e.y).toBeGreaterThanOrEqual(STORM_BAND_TOP);
      expect(e.y).toBeLessThanOrEqual(STORM_BAND_BOTTOM);
      expect(e.actionTimer).toBeGreaterThanOrEqual(3);
      expect(e.actionTimer).toBeLessThanOrEqual(5);
    }
  });

  it('spores drift at speed 50 in a random direction', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'spore', 100, 300);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(50);
  });

  it('about half of all trailers are homers', () => {
    const s = createGameState(1);
    let homers = 0;
    for (let i = 0; i < 400; i++) if (createEnemy(s, 'trailer', 100, 300).homer) homers++;
    expect(homers).toBeGreaterThan(150);
    expect(homers).toBeLessThan(250);
  });

  it('antimatter starts on its orbit at angle 0', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'antimatter', 1000, 300);
    expect(e.orbitAngle).toBe(0);
    expect(e.orbitX).toBe(1000 - ANTIMATTER_ORBIT_RADIUS);
    expect(e.orbitY).toBe(300);
  });

  it('nmeye starts with its bomb timer armed', () => {
    const s = createGameState(1);
    expect(createEnemy(s, 'nmeye', 0, 300).bombTimer).toBe(NMEYE_BOMB_INTERVAL);
  });

  it('convertEnemy clears planter/android links', () => {
    const s = createGameState(1);
    const e = createEnemy(s, 'planter', 0, 300);
    e.linkedId = 7;
    e.tetherLen = 50;
    convertEnemy(s, e, 'nemesite');
    expect(e.linkedId).toBeNull();
    expect(e.tetherLen).toBe(0);
    expect(e.radius).toBe(ENEMY_STATS.nemesite.radius);
  });
});
