import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../../../../src/game/state';
import { updateEnemies } from '../../../../src/game/systems/ai';
import { groundYAt } from '../../../../src/game/terrain';
import {
  SIM_DT, STORM_BAND_TOP, STORM_BAND_BOTTOM, ACID_SPEED, BOLT_LIFE, STORM_BOLT_DELAY,
} from '../../../../src/game/constants';
import { addEnemy } from '../../helpers';

function tick(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += SIM_DT) updateEnemies(s, SIM_DT);
}

describe('blunderstorm drift', () => {
  it('stays in the upper band and never fires shots', () => {
    const s = createGameState(1);
    const e = addEnemy(s, 'blunderstorm', 3000, 400);
    expect(e.fireTimer).toBe(Infinity);
    for (let t = 0; t < 10; t += SIM_DT) {
      updateEnemies(s, SIM_DT);
      expect(e.y).toBeGreaterThanOrEqual(STORM_BAND_TOP - 1);
      expect(e.y).toBeLessThanOrEqual(STORM_BAND_BOTTOM + 1);
    }
    expect(s.shots).toHaveLength(0);
  });
});

describe('blunderstorm actions', () => {
  function storms(s: GameState, n: number) {
    return Array.from({ length: n }, (_, i) => {
      const e = addEnemy(s, 'blunderstorm', 1000 + i * 400, 150);
      e.actionTimer = SIM_DT / 2;
      return e;
    });
  }

  it('each action either drops 5 acid drops or rumbles, and the next comes 3-5 s later', () => {
    const s = createGameState(1);
    const list = storms(s, 20);
    updateEnemies(s, SIM_DT);
    const rumbles = s.events.filter((e) => e.type === 'rumble').length;
    const acidStorms = list.filter((e) => e.boltTimer === 0).length;
    expect(rumbles + acidStorms).toBe(20);
    expect(rumbles).toBeGreaterThan(0);
    expect(acidStorms).toBeGreaterThan(0);
    expect(s.acid).toHaveLength(acidStorms * 5);
    for (const a of s.acid) expect(a.vy).toBe(ACID_SPEED);
    for (const e of list) {
      expect(e.actionTimer).toBeGreaterThanOrEqual(3);
      expect(e.actionTimer).toBeLessThanOrEqual(5);
    }
  });

  it('fires a proton bolt from the storm to the ground 0.8 s after its rumble', () => {
    const s = createGameState(1);
    const list = storms(s, 20);
    updateEnemies(s, SIM_DT);
    const rumbler = list.find((e) => e.boltTimer > 0)!;
    expect(rumbler.boltTimer).toBe(STORM_BOLT_DELAY);
    tick(s, STORM_BOLT_DELAY - 0.05);
    expect(s.bolts).toHaveLength(0);
    tick(s, 0.1);
    const bolt = s.bolts.find((b) => Math.abs(b.x - rumbler.x) < 10);
    expect(bolt).toBeDefined();
    expect(bolt!.life).toBe(BOLT_LIFE);
    expect(bolt!.bottom).toBeCloseTo(groundYAt(s.terrain, bolt!.x));
    expect(bolt!.top).toBeLessThan(STORM_BAND_BOTTOM + 30);
    expect(s.events.some((e) => e.type === 'protonBolt')).toBe(true);
  });
});
