import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import {
  updateHazards, resolveHazardHits, clearHazards, clearHazardsNear,
} from '../../../src/game/systems/hazards';
import { groundYAt } from '../../../src/game/terrain';
import { MAGMA_GRAVITY, ACID_SPEED, BOLT_LIFE, EYE_BOMB_SPEED, START_LIVES } from '../../../src/game/constants';
import { addMan } from '../helpers';

describe('updateHazards', () => {
  it('magma flies under gravity and despawns when it lands', () => {
    const s = createGameState(1);
    const ground = groundYAt(s.terrain, 3000);
    s.magma.push({ x: 3000, y: ground - 10, vx: 100, vy: -300, r: 5, hot: false });
    updateHazards(s, 0.1);
    expect(s.magma[0].vy).toBeCloseTo(-300 + MAGMA_GRAVITY * 0.1);
    expect(s.magma[0].x).toBeCloseTo(3010);
    expect(s.magma[0].y).toBeLessThan(ground - 10);
    for (let i = 0; i < 300 && s.magma.length > 0; i++) updateHazards(s, 0.01);
    expect(s.magma).toHaveLength(0);
  });

  it('rising magma below ground level is not removed', () => {
    const s = createGameState(1);
    const ground = groundYAt(s.terrain, 3000);
    s.magma.push({ x: 3000, y: ground + 2, vx: 0, vy: -300, r: 5, hot: false });
    updateHazards(s, 0.001);
    expect(s.magma).toHaveLength(1);
  });

  it('acid and nmeye bombs fall straight down and despawn on the ground', () => {
    const s = createGameState(1);
    s.acid.push({ x: 3000, y: 200, vy: ACID_SPEED });
    s.eyeBombs.push({ x: 3100, y: 200, vy: EYE_BOMB_SPEED });
    updateHazards(s, 0.5);
    expect(s.acid[0].y).toBeCloseTo(200 + ACID_SPEED * 0.5);
    expect(s.eyeBombs[0].y).toBeCloseTo(200 + EYE_BOMB_SPEED * 0.5);
    updateHazards(s, 5);
    expect(s.acid).toHaveLength(0);
    expect(s.eyeBombs).toHaveLength(0);
  });

  it('bolts expire after their lifetime', () => {
    const s = createGameState(1);
    s.bolts.push({ x: 3000, top: 150, bottom: 600, life: BOLT_LIFE });
    updateHazards(s, BOLT_LIFE - 0.05);
    expect(s.bolts).toHaveLength(1);
    updateHazards(s, 0.1);
    expect(s.bolts).toHaveLength(0);
  });
});

describe('resolveHazardHits', () => {
  it('magma kills the player and is used up', () => {
    const s = createGameState(1);
    s.magma.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, r: 5, hot: false });
    resolveHazardHits(s);
    expect(s.player.alive).toBe(false);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.magma).toHaveLength(0);
  });

  it('acid kills the player', () => {
    const s = createGameState(1);
    s.acid.push({ x: s.player.x + 5, y: s.player.y, vy: ACID_SPEED });
    resolveHazardHits(s);
    expect(s.player.alive).toBe(false);
  });

  it('an nmeye bomb kills the player', () => {
    const s = createGameState(1);
    s.eyeBombs.push({ x: s.player.x, y: s.player.y - 8, vy: EYE_BOMB_SPEED });
    resolveHazardHits(s);
    expect(s.player.alive).toBe(false);
  });

  it('a bolt kills the player inside its column but not beside it', () => {
    const s = createGameState(1);
    s.bolts.push({ x: s.player.x + 40, top: 100, bottom: 650, life: 0.2 });
    resolveHazardHits(s);
    expect(s.player.alive).toBe(true);
    s.bolts[0].x = s.player.x + 10;
    resolveHazardHits(s);
    expect(s.player.alive).toBe(false);
  });

  it('cloak and invulnerability protect the player', () => {
    const s = createGameState(1);
    s.magma.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, r: 5, hot: false });
    s.player.cloakActive = true;
    resolveHazardHits(s);
    expect(s.player.alive).toBe(true);
    s.player.cloakActive = false;
    s.player.invuln = 1;
    resolveHazardHits(s);
    expect(s.player.alive).toBe(true);
    expect(s.magma).toHaveLength(1);
  });

  it('hazards are harmless to men', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000);
    s.magma.push({ x: m.x, y: m.y, vx: 0, vy: 0, r: 5, hot: false });
    s.acid.push({ x: m.x, y: m.y, vy: ACID_SPEED });
    resolveHazardHits(s);
    expect(m.state).toBe('walking');
  });
});

describe('clearing hazards', () => {
  it('clearHazards empties every list', () => {
    const s = createGameState(1);
    s.magma.push({ x: 0, y: 0, vx: 0, vy: 0, r: 5, hot: false });
    s.acid.push({ x: 0, y: 0, vy: 1 });
    s.bolts.push({ x: 0, top: 0, bottom: 1, life: 1 });
    s.eyeBombs.push({ x: 0, y: 0, vy: 1 });
    clearHazards(s);
    expect(s.magma.length + s.acid.length + s.bolts.length + s.eyeBombs.length).toBe(0);
  });

  it('clearHazardsNear only clears magma, acid and bombs within range', () => {
    const s = createGameState(1);
    s.magma.push({ x: 1000, y: 0, vx: 0, vy: 0, r: 5, hot: false }, { x: 4000, y: 0, vx: 0, vy: 0, r: 5, hot: false });
    s.acid.push({ x: 1100, y: 0, vy: 1 });
    s.eyeBombs.push({ x: 900, y: 0, vy: 1 });
    s.bolts.push({ x: 1000, top: 0, bottom: 1, life: 1 });
    clearHazardsNear(s, 1000, 640);
    expect(s.magma).toHaveLength(1);
    expect(s.magma[0].x).toBe(4000);
    expect(s.acid).toHaveLength(0);
    expect(s.eyeBombs).toHaveLength(0);
    expect(s.bolts).toHaveLength(1);
  });
});
