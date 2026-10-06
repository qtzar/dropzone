import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import {
  ENEMY_STATS, createEnemy, fireInterval, convertEnemy, makeAggressive, AGGRESSIVE_SPEED_MULT,
} from '../../../src/game/entities/enemies';

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
