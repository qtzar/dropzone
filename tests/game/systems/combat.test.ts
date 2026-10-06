import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import {
  killEnemy, resolveLaserHits, killPlayer, resolvePlayerHits, pruneDead,
} from '../../../src/game/systems/combat';
import { ENEMY_STATS } from '../../../src/game/entities/enemies';
import { START_LIVES, HITSTOP_MULTI, HITSTOP_HUNTER, RESPAWN_DELAY } from '../../../src/game/constants';
import { addMan, addEnemy } from '../helpers';

describe('laser hits', () => {
  it('a laser kills an enemy, scores and explodes', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'snatcher', 2000, 300);
    s.lasers.push({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 });
    resolveLaserHits(s);
    expect(e.dead).toBe(true);
    expect(s.lasers[0].life).toBe(0);
    expect(s.score).toBe(ENEMY_STATS.snatcher.points);
    expect(s.events).toContainEqual({ type: 'explosion', x: 2000, y: 300, source: 'snatcher', big: false });
    pruneDead(s);
    expect(s.enemies).toHaveLength(0);
    expect(s.lasers).toHaveLength(0);
  });

  it('one laser only kills one enemy', () => {
    const s = createGameState(1);
    addEnemy(s, 'snatcher', 2000, 300);
    addEnemy(s, 'snatcher', 2005, 300);
    s.lasers.push({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 });
    resolveLaserHits(s);
    expect(s.enemies.filter((e) => e.dead)).toHaveLength(1);
  });

  it('two kills in one tick trigger hit-stop', () => {
    const s = createGameState(1);
    addEnemy(s, 'snatcher', 2000, 300);
    addEnemy(s, 'snatcher', 3000, 300);
    s.lasers.push({ prevX: 1990, x: 2010, y: 300, vx: 2200, life: 0.3 });
    s.lasers.push({ prevX: 2990, x: 3010, y: 300, vx: 2200, life: 0.3 });
    resolveLaserHits(s);
    expect(s.hitStop).toBe(HITSTOP_MULTI);
  });
});

describe('killEnemy', () => {
  it('orb splits into three fragments', () => {
    const s = createGameState(1);
    const orb = addEnemy(s, 'orb', 2000, 300);
    killEnemy(s, orb);
    const frags = s.enemies.filter((e) => e.kind === 'fragment');
    expect(frags).toHaveLength(3);
    for (const f of frags) expect(Math.hypot(f.vx, f.vy)).toBeGreaterThan(0);
  });

  it('killing a carrying snatcher drops the man', () => {
    const s = createGameState(1);
    const m = addMan(s, 2000, 'snatched');
    const e = addEnemy(s, 'snatcher', 2000, 300);
    m.y = 320;
    m.holderId = e.id;
    e.carryingId = m.id;
    killEnemy(s, e);
    expect(m.state).toBe('falling');
    expect(m.holderId).toBeNull();
    expect(m.fallStartY).toBe(320);
  });

  it('killing a hunter triggers hit-stop', () => {
    const s = createGameState(1);
    killEnemy(s, addEnemy(s, 'hunter', 2000, 300));
    expect(s.hitStop).toBe(HITSTOP_HUNTER);
  });

  it('is idempotent', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'snatcher', 2000, 300);
    killEnemy(s, e);
    killEnemy(s, e);
    expect(s.score).toBe(ENEMY_STATS.snatcher.points);
  });
});

describe('player hits', () => {
  it('an enemy shot kills the player, costs a life and drops a carried man', () => {
    const s = createGameState(1);
    const m = addMan(s, s.player.x, 'carried');
    s.player.carryingId = m.id;
    m.y = s.player.y + 200; // keep the man out of the shot's way
    s.shots.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, life: 1 });
    resolvePlayerHits(s);
    expect(s.player.alive).toBe(false);
    expect(s.player.respawnTimer).toBe(RESPAWN_DELAY);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(m.state).toBe('falling');
    expect(s.player.carryingId).toBeNull();
    expect(s.events.some((e) => e.type === 'playerDied')).toBe(true);
  });

  it('touching an enemy kills the player', () => {
    const s = createGameState(1);
    addEnemy(s, 'nemesite', s.player.x + 5, s.player.y);
    resolvePlayerHits(s);
    expect(s.player.alive).toBe(false);
  });

  it('trails are hazardous', () => {
    const s = createGameState(1);
    s.trails.push({ x: s.player.x, y: s.player.y, life: 1 });
    resolvePlayerHits(s);
    expect(s.player.alive).toBe(false);
  });

  it('cloak and invulnerability protect the player', () => {
    const s = createGameState(1);
    s.shots.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, life: 1 });
    s.player.cloakActive = true;
    resolvePlayerHits(s);
    expect(s.player.alive).toBe(true);
    s.player.cloakActive = false;
    s.player.invuln = 1;
    resolvePlayerHits(s);
    expect(s.player.alive).toBe(true);
  });

  it('an enemy shot can kill the carried man', () => {
    const s = createGameState(1);
    const m = addMan(s, s.player.x, 'carried');
    s.player.carryingId = m.id;
    m.y = s.player.y + 26;
    s.shots.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 1 });
    resolvePlayerHits(s);
    expect(m.state).toBe('dead');
    expect(s.player.carryingId).toBeNull();
    expect(s.player.alive).toBe(true);
  });

  it('losing the last life ends the game', () => {
    const s = createGameState(1);
    s.lives = 1;
    killPlayer(s);
    expect(s.lives).toBe(0);
    expect(s.phase).toBe('gameOver');
    expect(s.events.some((e) => e.type === 'gameOver')).toBe(true);
  });
});

describe('planter and android kills', () => {
  function lowering(s: ReturnType<typeof createGameState>) {
    const m = addMan(s, 3000, 'chased');
    const p = addEnemy(s, 'planter', 3000, 300);
    const a = addEnemy(s, 'android', 3000, 360);
    p.linkedId = a.id;
    p.tetherLen = 60;
    a.linkedId = p.id;
    a.targetId = m.id;
    m.holderId = a.id;
    return { m, p, a };
  }

  it('killing a Planter while it lowers drops its Android, which is then worth 500', () => {
    const s = createGameState(1);
    const { p, a } = lowering(s);
    killEnemy(s, p);
    expect(a.falling).toBe(true);
    expect(a.linkedId).toBeNull();
    expect(s.score).toBe(ENEMY_STATS.planter.points);
    killEnemy(s, a);
    expect(s.score).toBe(ENEMY_STATS.planter.points + 500 * 2); // second kill in the combo window is x2
  });

  it('a lowering or walking Android is worth 50', () => {
    const s = createGameState(1);
    const { a } = lowering(s);
    killEnemy(s, a);
    expect(s.score).toBe(50);
  });

  it('killing a lowering Android turns its Planter into a Nemesite and frees the man', () => {
    const s = createGameState(1);
    const { m, p, a } = lowering(s);
    killEnemy(s, a);
    expect(p.kind).toBe('nemesite');
    expect(p.linkedId).toBeNull();
    expect(m.state).toBe('walking');
    expect(m.holderId).toBeNull();
  });
});
