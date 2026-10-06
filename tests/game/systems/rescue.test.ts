import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../src/game/state';
import { spawnMen, updateMen, canDeliver, checkUnstable, rescuePoints } from '../../../src/game/systems/rescue';
import { registerKill } from '../../../src/game/systems/scoring';
import {
  SIM_DT, MAN_CARRY_OFFSET, MAN_SAFE_FALL, MAN_RADIUS, CATCH_POINTS, PLAYER_RADIUS, SNATCH_CARRY_OFFSET,
  MAN_WALK_SPEED, BASE_WIDTH,
} from '../../../src/game/constants';
import { groundYAt, BASE_GROUND_Y } from '../../../src/game/terrain';
import { isLake, isLava } from '../../../src/game/landscape';
import { WORLD_W, shortestDx } from '../../../src/core/world';
import { addMan, addEnemy } from '../helpers';

function tick(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateMen(s, SIM_DT);
}

/** Lake at 4000 (3820..4180), lava ditch at 6000 (5968..6032), nothing else near the base. */
function testLandscape(s: GameState) {
  s.landscape = { volcanoes: [{ x: 8000, timer: 99 }], lakeX: 4000, ditches: [6000], craters: [9000] };
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

  it('never spawns a man on or next to the base pad, in the lake or in a lava ditch', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = createGameState(seed);
      spawnMen(s, 8);
      for (const m of s.men) {
        expect(Math.abs(shortestDx(s.baseX, m.x))).toBeGreaterThanOrEqual(BASE_WIDTH / 2 + 200 - 1);
        expect(isLake(s.landscape, m.x)).toBe(false);
        expect(isLava(s.landscape, m.x)).toBe(false);
      }
    }
  });
});

describe('walking to the base', () => {
  it('walking men stay on the ground', () => {
    const s = createGameState(1);
    const m = addMan(s, 3000);
    tick(s, 3);
    expect(m.y).toBeCloseTo(groundYAt(s.terrain, m.x) - MAN_RADIUS);
  });

  it('walk toward the base at the walking speed', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, 3000);
    m.walkTimer = 0;
    tick(s, 1);
    expect(m.dir).toBe(-1);
    expect(3000 - m.x).toBeCloseTo(MAN_WALK_SPEED, 0);
  });

  it('take the shortest wrapped direction', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, WORLD_W - 300);
    m.walkTimer = 0;
    tick(s, 1);
    expect(m.dir).toBe(1);
    expect(shortestDx(WORLD_W - 300, m.x)).toBeCloseTo(MAN_WALK_SPEED, 0);
  });

  it('turn back at the lake edge for 1-2 s, then head for the base again, never entering it', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, 4200);
    m.walkTimer = 0;
    let turned = false;
    for (let t = 0; t < 12; t += SIM_DT) {
      updateMen(s, SIM_DT);
      expect(isLake(s.landscape, m.x)).toBe(false);
      if (m.dir === 1) {
        turned = true;
        expect(m.walkTimer).toBeLessThanOrEqual(2);
      }
    }
    expect(turned).toBe(true);
    expect(m.x).toBeGreaterThan(4180);
    expect(m.x).toBeLessThan(4180 + 2 * MAN_WALK_SPEED + 1);
  });

  it('turn back at a lava ditch edge', () => {
    const s = createGameState(1);
    // Ditch at 3000 (covers ~2968..3032); man walks left toward base at 640
    s.landscape = { volcanoes: [], lakeX: 8000, ditches: [3000], craters: [] };
    const m = addMan(s, 3060);
    m.walkTimer = 0;
    let turned = false;
    for (let t = 0; t < 4; t += SIM_DT) {
      updateMen(s, SIM_DT);
      expect(isLava(s.landscape, m.x)).toBe(false);
      if (m.dir === 1) {
        turned = true;
        expect(m.walkTimer).toBeLessThanOrEqual(2);
      }
    }
    expect(turned).toBe(true);
    expect(m.x).toBeGreaterThan(3032);
  });

  it('a man who reaches the base pad rescues himself: survivor, no points', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, s.baseX + BASE_WIDTH / 2 + 5);
    m.walkTimer = 0;
    tick(s, 1);
    expect(m.state).toBe('saved');
    expect(s.savedThisWave).toBe(1);
    expect(s.score).toBe(0);
    expect(s.events.some((e) => e.type === 'manSelfRescued')).toBe(true);
  });
});

describe('pickup', () => {
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
  function deliverAt(s: GameState) {
    const m = addMan(s, s.baseX, 'carried');
    s.player.carryingId = m.id;
    s.player.x = s.baseX;
    s.player.y = BASE_GROUND_Y - PLAYER_RADIUS;
    return m;
  }

  it('delivering at the base saves the man and scores 100 x wave', () => {
    const s = createGameState(1);
    s.wave = 3;
    const m = deliverAt(s);
    expect(canDeliver(s)).toBe(true);
    updateMen(s, SIM_DT);
    expect(m.state).toBe('saved');
    expect(s.player.carryingId).toBeNull();
    expect(s.savedThisWave).toBe(1);
    expect(s.score).toBe(300);
    expect(s.events.some((e) => e.type === 'manRescued')).toBe(true);
  });

  it('the rescue bonus is capped at 500 and multiplied by the combo', () => {
    expect(rescuePoints(1)).toBe(100);
    expect(rescuePoints(5)).toBe(500);
    expect(rescuePoints(12)).toBe(500);
    const s = createGameState(1);
    s.wave = 7;
    registerKill(s, 0, 0, 0);
    registerKill(s, 0, 0, 0); // x2
    deliverAt(s);
    updateMen(s, SIM_DT);
    expect(s.score).toBe(1000);
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

  it('a short fall into a lava ditch kills him', () => {
    const s = createGameState(1);
    testLandscape(s);
    const m = addMan(s, 6000, 'falling');
    const ground = groundYAt(s.terrain, 6000) - MAN_RADIUS;
    m.y = ground - 20;
    m.fallStartY = m.y;
    s.player.x = 9000;
    tick(s, 2);
    expect(m.state).toBe('dead');
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

describe('checkUnstable', () => {
  it('goes unstable when every man is dead, turning Planters and Androids into Antimatter', () => {
    const s = createGameState(1);
    const a = addMan(s, 1000, 'dead');
    addMan(s, 2000, 'dead');
    const planter = addEnemy(s, 'planter', 4000, 300);
    const android = addEnemy(s, 'android', 5000, 600);
    const nemesite = addEnemy(s, 'nemesite', 6000, 300);
    checkUnstable(s);
    expect(s.unstable).toBe(true);
    expect(s.menRemaining).toBe(0);
    expect(planter.kind).toBe('antimatter');
    expect(android.kind).toBe('antimatter');
    expect(planter.orbitX).toBeCloseTo(4000 - 80);
    expect(nemesite.kind).toBe('nemesite');
    expect(s.events.filter((ev) => ev.type === 'planetUnstable')).toHaveLength(1);
    a.state = 'dead';
    checkUnstable(s);
    expect(s.events.filter((ev) => ev.type === 'planetUnstable')).toHaveLength(1);
  });

  it('does not go unstable if any man was saved or is alive', () => {
    const s = createGameState(1);
    addMan(s, 1000, 'dead');
    addMan(s, 2000, 'saved');
    checkUnstable(s);
    expect(s.unstable).toBe(false);
  });

  it('does not go unstable in a wave with no men', () => {
    const s = createGameState(1);
    checkUnstable(s);
    expect(s.unstable).toBe(false);
  });
});
