import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import { spawnMen, updateMen, canDeliver, checkCritical } from '../../../src/game/systems/rescue';
import {
  SIM_DT, MAN_CARRY_OFFSET, MAN_SAFE_FALL, MAN_RADIUS, RESCUE_POINTS, CATCH_POINTS, PLAYER_RADIUS, SNATCH_CARRY_OFFSET,
} from '../../../src/game/constants';
import { groundYAt, BASE_GROUND_Y } from '../../../src/game/terrain';
import { WORLD_W } from '../../../src/core/world';
import { addMan, addEnemy } from '../helpers';

function tick(s: ReturnType<typeof createGameState>, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateMen(s, SIM_DT);
}

describe('spawnMen', () => {
  it('spawns walking men spread across the world on the ground', () => {
    const s = createGameState(1);
    spawnMen(s, 8);
    expect(s.men).toHaveLength(8);
    for (const m of s.men) {
      expect(m.state).toBe('walking');
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x).toBeLessThan(WORLD_W);
      expect(m.y).toBeCloseTo(groundYAt(s.terrain, m.x) - MAN_RADIUS);
    }
    const xs = s.men.map((m) => m.x).sort((a, b) => a - b);
    expect(xs[7] - xs[0]).toBeGreaterThan(WORLD_W / 2);
  });
});

describe('walking and pickup', () => {
  it('walking men stay on the ground', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000);
    tick(s, 3);
    expect(m.y).toBeCloseTo(groundYAt(s.terrain, m.x) - MAN_RADIUS);
  });

  it('the player picks up a man by touching him', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000);
    s.player.x = m.x;
    s.player.y = m.y - PLAYER_RADIUS;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('carried');
    expect(s.player.carryingId).toBe(m.id);
    expect(s.events.some((e) => e.type === 'manPickedUp')).toBe(true);
  });

  it('cannot carry two men', () => {
    const s = createGameState(1);
    const a = addMan(s, 3000);
    const b = addMan(s, 3000);
    s.player.x = 3000;
    s.player.y = a.y - PLAYER_RADIUS;
    updateMen(s, SIM_DT);
    expect([a.state, b.state].filter((st) => st === 'carried')).toHaveLength(1);
  });

  it('a carried man hangs below the player', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'carried');
    s.player.carryingId = m.id;
    s.player.x = 3100;
    s.player.y = 300;
    updateMen(s, SIM_DT);
    expect(m.x).toBe(3100);
    expect(m.y).toBe(300 + MAN_CARRY_OFFSET);
  });
});

describe('delivery', () => {
  it('delivering at the base saves the man and scores', () => {
    const s = createGameState(1);
    const m = addMan(s, s.baseX, 'carried');
    s.player.carryingId = m.id;
    s.player.x = s.baseX;
    s.player.y = BASE_GROUND_Y - PLAYER_RADIUS;
    expect(canDeliver(s)).toBe(true);
    updateMen(s, SIM_DT);
    expect(m.state).toBe('saved');
    expect(s.player.carryingId).toBeNull();
    expect(s.savedThisWave).toBe(1);
    expect(s.score).toBe(RESCUE_POINTS);
    expect(s.events.some((e) => e.type === 'manRescued')).toBe(true);
  });

  it('flying high over the base does not deliver', () => {
    const s = createGameState(1);
    s.player.x = s.baseX;
    s.player.y = 200;
    expect(canDeliver(s)).toBe(false);
  });
});

describe('falling', () => {
  it('a man dropped from high up dies on landing', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'falling');
    const ground = groundYAt(s.terrain, 3000) - MAN_RADIUS;
    m.y = ground - MAN_SAFE_FALL - 50;
    m.fallStartY = m.y;
    s.player.x = 6000;
    tick(s, 3);
    expect(m.state).toBe('dead');
    expect(s.events.some((e) => e.type === 'manDied')).toBe(true);
  });

  it('a short fall is survivable', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'falling');
    const ground = groundYAt(s.terrain, 3000) - MAN_RADIUS;
    m.y = ground - 50;
    m.fallStartY = m.y;
    s.player.x = 6000;
    tick(s, 2);
    expect(m.state).toBe('walking');
  });

  it('catching a falling man scores a bonus and carries him', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'falling');
    m.y = 300;
    m.fallStartY = 300;
    s.player.x = 3000;
    s.player.y = 300;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('carried');
    expect(s.player.carryingId).toBe(m.id);
    expect(s.score).toBe(CATCH_POINTS);
    expect(s.events.some((e) => e.type === 'manCaught')).toBe(true);
  });
});

describe('snatched', () => {
  it('follows the holder and falls when the holder is gone', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'snatched');
    const e = addEnemy(s, 'snatcher', 3050, 250);
    m.holderId = e.id;
    updateMen(s, SIM_DT);
    expect(m.x).toBe(3050);
    expect(m.y).toBe(250 + SNATCH_CARRY_OFFSET);
    e.dead = true;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('falling');
  });
});

describe('checkCritical', () => {
  it('goes critical when every man is dead', () => {
    const s = createGameState(1);
    const a = addMan(s, 1000, 'dead');
    addMan(s, 2000, 'dead');
    const e = addEnemy(s, 'snatcher', 4000, 300);
    checkCritical(s);
    expect(s.critical).toBe(true);
    expect(s.menRemaining).toBe(0);
    expect(e.kind).toBe('nemesite');
    expect(e.aggressive).toBe(true);
    expect(s.events.filter((ev) => ev.type === 'planetCritical')).toHaveLength(1);
    a.state = 'dead';
    checkCritical(s);
    expect(s.events.filter((ev) => ev.type === 'planetCritical')).toHaveLength(1);
  });

  it('does not go critical if any man was saved or is alive', () => {
    const s = createGameState(1);
    addMan(s, 1000, 'dead');
    addMan(s, 2000, 'saved');
    checkCritical(s);
    expect(s.critical).toBe(false);
  });

  it('does not go critical in a wave with no men', () => {
    const s = createGameState(1);
    checkCritical(s);
    expect(s.critical).toBe(false);
  });
});

describe('chased', () => {
  it('a chased man keeps walking and can be picked up', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'chased');
    const a = addEnemy(s, 'android', 3500, 600);
    a.targetId = m.id;
    m.holderId = a.id;
    tick(s, 0.5);
    expect(m.state).toBe('chased');
    expect(m.x).not.toBe(3000);
    s.player.x = m.x;
    s.player.y = m.y - PLAYER_RADIUS;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('carried');
    expect(m.holderId).toBeNull();
  });

  it('goes back to walking when his Android is gone', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000, 'chased');
    const a = addEnemy(s, 'android', 3500, 600);
    a.targetId = m.id;
    m.holderId = a.id;
    a.dead = true;
    updateMen(s, SIM_DT);
    expect(m.state).toBe('walking');
    expect(m.holderId).toBeNull();
  });
});
