import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../../src/game/state';
import { updateEnemies } from '../../../../src/game/systems/ai';
import { groundYAt } from '../../../../src/game/terrain';
import {
  SIM_DT, PLANT_GRACE, PLANTER_RISE, TETHER_SPEED, ANDROID_CHASE_MULT, MAN_WALK_SPEED,
} from '../../../../src/game/constants';
import { addMan, addEnemy } from '../../helpers';

function tick(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

/** A landscape with nothing near x = 2500..3500 unless the test adds it. */
function plainLandscape(s: GameState) {
  s.landscape = { volcanoes: [{ x: 8000, timer: 99 }], lakeX: 6000, ditches: [9000], craters: [9500] };
}

function planter(s: GameState, x: number) {
  const e = addEnemy(s, 'planter', x, 300);
  e.fireTimer = Infinity;
  return e;
}

describe('planter cruising', () => {
  it('drifts horizontally at its cruise height', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const e = planter(s, 3000);
    const x0 = e.x;
    tick(s, 1);
    expect(Math.abs(e.y - e.homeY)).toBeLessThan(1);
    expect(Math.abs(e.x - x0)).toBeGreaterThan(50);
  });

  it('rises 120 above its cruise height over a volcano', () => {
    const s = createGameState(1);
    plainLandscape(s);
    s.landscape.volcanoes = [{ x: 3000, timer: 99 }];
    const e = planter(s, 3000);
    e.speed = 0;
    tick(s, 4);
    expect(e.y).toBeCloseTo(e.homeY - PLANTER_RISE, 0);
  });

  it('rises 120 above its cruise height over the base', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const e = planter(s, s.baseX);
    e.speed = 0;
    tick(s, 4);
    expect(e.y).toBeCloseTo(e.homeY - PLANTER_RISE, 0);
  });
});

describe('planting grace', () => {
  it('does not plant during the first PLANT_GRACE seconds of a wave, then does', () => {
    const s = createGameState(1);
    plainLandscape(s);
    addMan(s, 3000);
    const e = planter(s, 3000);
    e.speed = 0;
    s.waveTime = 0;
    updateEnemies(s, SIM_DT);
    expect(e.linkedId).toBeNull();
    s.waveTime = PLANT_GRACE - 0.01;
    updateEnemies(s, SIM_DT);
    expect(e.linkedId).toBeNull();
    s.waveTime = PLANT_GRACE;
    updateEnemies(s, SIM_DT);
    expect(e.linkedId).not.toBeNull();
  });
});

describe('planter lowering an android', () => {
  it('hovers and lowers an Android onto a walking man within 40 px', () => {
    const s = createGameState(1);
    plainLandscape(s);
    s.waveTime = PLANT_GRACE;
    const m = addMan(s, 3000);
    const e = planter(s, 3030);
    updateEnemies(s, SIM_DT);
    const android = s.enemies.find((o) => o.kind === 'android');
    expect(android).toBeDefined();
    expect(e.linkedId).toBe(android!.id);
    expect(android!.linkedId).toBe(e.id);
    expect(android!.targetId).toBe(m.id);
    expect(e.vx).toBe(0);
    expect(m.state).toBe('chased');
    expect(m.holderId).toBe(android!.id);
    expect(s.events).toContainEqual({ type: 'manWhistle', x: m.x, y: m.y });
  });

  it('ignores men further than 40 px away and men already chased', () => {
    const s = createGameState(1);
    plainLandscape(s);
    addMan(s, 3000);
    const chased = addMan(s, 5000, 'chased');
    planter(s, 3100).speed = 0;
    planter(s, 5010).speed = 0;
    updateEnemies(s, SIM_DT);
    expect(s.enemies.some((o) => o.kind === 'android')).toBe(false);
    expect(chased.holderId).toBeNull();
  });

  it('grows the tether at 120 px/s with the Android hanging at its end', () => {
    const s = createGameState(1);
    plainLandscape(s);
    s.waveTime = PLANT_GRACE;
    addMan(s, 3000);
    const e = planter(s, 3000);
    updateEnemies(s, SIM_DT);
    const len0 = e.tetherLen;
    tick(s, 0.5);
    const android = s.enemies.find((o) => o.kind === 'android')!;
    expect(e.tetherLen).toBeCloseTo(len0 + TETHER_SPEED * 0.5, 0);
    expect(android.x).toBe(e.x);
    expect(android.y).toBeCloseTo(e.y + e.tetherLen, 0);
  });

  it('converts to a Nemesite once its Android lands', () => {
    const s = createGameState(1);
    plainLandscape(s);
    s.waveTime = PLANT_GRACE;
    addMan(s, 3000);
    const e = planter(s, 3000);
    tick(s, 5);
    const android = s.enemies.find((o) => o.kind === 'android')!;
    expect(e.kind).toBe('nemesite');
    expect(e.linkedId).toBeNull();
    expect(android.linkedId).toBeNull();
    expect(android.y).toBeCloseTo(groundYAt(s.terrain, android.x) - android.radius, 0);
  });
});

describe('android on the ground', () => {
  function landedAndroid(s: GameState, x: number, targetX: number) {
    const m = addMan(s, targetX, 'chased');
    m.walkTimer = 999;
    const a = addEnemy(s, 'android', x, groundYAt(s.terrain, x) - 9);
    a.targetId = m.id;
    m.holderId = a.id;
    return { m, a };
  }

  it('chases its man along the surface at 1.6x walking speed', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const { a } = landedAndroid(s, 3000, 3300);
    tick(s, 1);
    expect(a.x - 3000).toBeCloseTo(ANDROID_CHASE_MULT * MAN_WALK_SPEED, 0);
    expect(a.y).toBeCloseTo(groundYAt(s.terrain, a.x) - a.radius, 0);
  });

  it('kills the man on contact and then wanders', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const { m, a } = landedAndroid(s, 3000, 3010);
    updateEnemies(s, SIM_DT);
    expect(m.state).toBe('dead');
    expect(a.targetId).toBeNull();
    expect(s.events.some((e) => e.type === 'manDied')).toBe(true);
    const x = a.x;
    tick(s, 1);
    expect(Math.abs(a.x - x)).toBeCloseTo(MAN_WALK_SPEED, 0);
  });

  it('a falling Android dies when it hits the ground', () => {
    const s = createGameState(1);
    plainLandscape(s);
    const a = addEnemy(s, 'android', 3000, 300);
    a.falling = true;
    tick(s, 3);
    expect(a.dead).toBe(true);
    expect(s.score).toBe(0);
    expect(s.events.some((e) => e.type === 'explosion' && e.source === 'android')).toBe(true);
  });
});
