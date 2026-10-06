import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../../src/game/state';
import { updateEnemies } from '../../../../src/game/systems/ai';
import { releaseTrailers, trailerHeadHit } from '../../../../src/game/systems/ai/spawners';
import { killEnemy, resolveLaserHits } from '../../../../src/game/systems/combat';
import { ENEMY_STATS } from '../../../../src/game/entities/enemies';
import { SIM_DT, CEILING_Y } from '../../../../src/game/constants';
import { addEnemy } from '../../helpers';

function tick(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

describe('spore', () => {
  it('drifts at speed 50, bounces off the ceiling and never fires', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'spore', 3000, CEILING_Y + 2);
    e.vx = 30;
    e.vy = -40;
    tick(s, 0.2);
    expect(e.vy).toBeGreaterThan(0);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(50);
    expect(e.fireTimer).toBe(Infinity);
    tick(s, 3);
    expect(s.shots).toHaveLength(0);
  });

  it('releases 4 Trailers at 90 degree intervals when killed', () => {
    const s = createGameState(1);
    const spore = addEnemy(s, 'spore', 3000, 300);
    killEnemy(s, spore);
    const trailers = s.enemies.filter((e) => e.kind === 'trailer');
    expect(trailers).toHaveLength(4);
    const quadrants = new Set(trailers.map((t) => `${Math.sign(t.vx)},${Math.sign(t.vy)}`));
    expect(quadrants.size).toBe(4);
    for (const t of trailers) {
      expect(t.x).toBe(3000);
      expect(t.y).toBe(300);
      expect(t.dead).toBe(false);
    }
    expect(s.score).toBe(ENEMY_STATS.spore.points);
  });

  it('releaseTrailers returns the new Trailers', () => {
    const s = createGameState(1);
    const spore = addEnemy(s, 'spore', 3000, 300);
    const out = releaseTrailers(s, spore);
    expect(out).toHaveLength(4);
    expect(s.enemies).toHaveLength(5);
  });
});

describe('trailer', () => {
  it('a homer turns toward the player', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', s.player.x + 500, s.player.y);
    e.homer = true;
    e.fireTimer = Infinity;
    e.vx = e.speed;
    tick(s, 2);
    expect(e.vx).toBeLessThan(0);
  });

  it('a non-homer weaves along its home line', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 3000, 300);
    e.homer = false;
    e.fireTimer = Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let t = 0; t < 3; t += SIM_DT) {
      updateEnemies(s, SIM_DT);
      minY = Math.min(minY, e.y);
      maxY = Math.max(maxY, e.y);
    }
    expect(maxY - minY).toBeGreaterThan(100);
    expect(Math.abs(e.vx)).toBeCloseTo(e.speed);
  });
});

describe('trailer head-hit rule', () => {
  it('a laser meeting the Trailer head-on kills it', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 2000, 300);
    e.vx = -200;
    s.lasers.push({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 });
    expect(trailerHeadHit(s.lasers[0], e)).toBe(true);
    resolveLaserHits(s);
    expect(e.dead).toBe(true);
    expect(s.score).toBe(ENEMY_STATS.trailer.points);
  });

  it('a laser hitting the tail is absorbed and the Trailer survives', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 2000, 300);
    e.vx = 200;
    s.lasers.push({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 });
    expect(trailerHeadHit(s.lasers[0], e)).toBe(false);
    resolveLaserHits(s);
    expect(e.dead).toBe(false);
    expect(s.lasers[0].life).toBe(0);
    expect(s.score).toBe(0);
    expect(s.events).toContainEqual({ type: 'laserBlocked', x: 2000, y: 300 });
  });

  it('a Trailer with no horizontal speed can be hit from either side', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'trailer', 2000, 300);
    e.vx = 0;
    expect(trailerHeadHit({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 }, e)).toBe(true);
    expect(trailerHeadHit({ prevX: 2010, x: 1990, y: 300, vx: -2200, life: 0.3 }, e)).toBe(true);
  });
});
