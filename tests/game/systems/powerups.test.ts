import { describe, it, expect } from 'vitest';
import { createGameState } from '../../../src/game/state';
import { NO_ACTIONS } from '../../../src/core/input';
import { updateCloak, triggerBomb, updateRespawn, RESPAWN_Y } from '../../../src/game/systems/powerups';
import {
  SHIELD_START, SHIELD_DRAIN, RESPAWN_DELAY, RESPAWN_INVULN, START_BOMBS, HITSTOP_MULTI,
} from '../../../src/game/constants';
import { CAMERA_LEAD, WORLD_W, VIEW_W, shortestDx } from '../../../src/core/world';
import { addEnemy } from '../helpers';

const CLOAK = { ...NO_ACTIONS, cloak: true };

describe('updateCloak (shield bank)', () => {
  it('activates while held and drains 1 s of shield per second', () => {
    const s = createGameState(1);
    expect(s.shieldBank).toBe(SHIELD_START);
    updateCloak(s, CLOAK, 1);
    expect(s.player.cloakActive).toBe(true);
    expect(s.shieldBank).toBeCloseTo(SHIELD_START - SHIELD_DRAIN);
    expect(s.events).toContainEqual({ type: 'cloakOn' });
  });

  it('deactivates on release and emits cloakOff', () => {
    const s = createGameState(1);
    updateCloak(s, CLOAK, 0.1);
    updateCloak(s, NO_ACTIONS, 0.1);
    expect(s.player.cloakActive).toBe(false);
    expect(s.shieldBank).toBeCloseTo(SHIELD_START - 0.1);
    expect(s.events).toContainEqual({ type: 'cloakOff' });
  });

  it('turns off when the bank is empty', () => {
    const s = createGameState(1);
    s.shieldBank = 0.01;
    updateCloak(s, CLOAK, 1);
    expect(s.shieldBank).toBe(0);
    updateCloak(s, CLOAK, 0.01);
    expect(s.player.cloakActive).toBe(false);
  });

  it('does not activate while dead', () => {
    const s = createGameState(1);
    s.player.alive = false;
    updateCloak(s, CLOAK, 0.1);
    expect(s.player.cloakActive).toBe(false);
  });
});

describe('triggerBomb', () => {
  it('kills on-screen enemies, spares distant ones, clears nearby shots', () => {
    const s = createGameState(1);
    const near1 = addEnemy(s, 'nemesite', s.player.x + 300, 300);
    const near2 = addEnemy(s, 'nemesite', s.player.x - 300, 300);
    const far = addEnemy(s, 'nemesite', s.player.x + 3000, 300);
    s.shots.push({ x: s.player.x + 100, y: 300, vx: 0, vy: 0, life: 1 });
    s.shots.push({ x: s.player.x + 3000, y: 300, vx: 0, vy: 0, life: 1 });
    expect(triggerBomb(s)).toBe(true);
    expect(near1.dead).toBe(true);
    expect(near2.dead).toBe(true);
    expect(far.dead).toBe(false);
    expect(s.shots).toHaveLength(1);
    expect(s.bombs).toBe(START_BOMBS - 1);
    expect(s.hitStop).toBe(HITSTOP_MULTI);
    expect(s.events.some((e) => e.type === 'bombDetonated')).toBe(true);
  });

  it('is centred on the led screen, not on the player', () => {
    const s = createGameState(1);
    s.player.facing = 1;
    const ahead = addEnemy(s, 'nemesite', s.player.x + 800, 300);
    const behind = addEnemy(s, 'nemesite', s.player.x - 550, 300);
    triggerBomb(s);
    expect(ahead.dead).toBe(true);
    expect(behind.dead).toBe(false);
    expect(CAMERA_LEAD).toBeGreaterThan(0);
  });

  it('spares Androids', () => {
    const s = createGameState(1);
    const android = addEnemy(s, 'android', s.player.x + 200, 600);
    const planter = addEnemy(s, 'planter', s.player.x + 250, 300);
    triggerBomb(s);
    expect(android.dead).toBe(false);
    expect(planter.dead).toBe(true);
  });

  it('Spores killed by the bomb release Trailers that survive the blast', () => {
    const s = createGameState(1);
    addEnemy(s, 'spore', s.player.x + 200, 300);
    triggerBomb(s);
    const alive = s.enemies.filter((e) => !e.dead);
    expect(alive).toHaveLength(4);
    expect(alive.every((e) => e.kind === 'trailer')).toBe(true);
  });

  it('clears acid, magma and Nmeye bombs on screen', () => {
    const s = createGameState(1);
    s.acid.push({ x: s.player.x + 100, y: 300, vy: 220 });
    s.magma.push({ x: s.player.x - 100, y: 300, vx: 0, vy: 0, r: 5, hot: false });
    s.eyeBombs.push({ x: s.player.x, y: 200, vy: 180 });
    s.acid.push({ x: s.player.x + 4000, y: 300, vy: 220 });
    triggerBomb(s);
    expect(s.magma).toHaveLength(0);
    expect(s.eyeBombs).toHaveLength(0);
    expect(s.acid).toHaveLength(1);
  });

  it('does nothing without bombs or while dead', () => {
    const s = createGameState(1);
    s.bombs = 0;
    expect(triggerBomb(s)).toBe(false);
    s.bombs = 1;
    s.player.alive = false;
    expect(triggerBomb(s)).toBe(false);
    expect(s.bombs).toBe(1);
  });
});

describe('updateRespawn', () => {
  it('respawns after the delay with invulnerability', () => {
    const s = createGameState(1);
    s.player.alive = false;
    s.player.respawnTimer = RESPAWN_DELAY;
    updateRespawn(s, RESPAWN_DELAY - 0.1);
    expect(s.player.alive).toBe(false);
    updateRespawn(s, 0.2);
    expect(s.player.alive).toBe(true);
    expect(s.player.y).toBe(RESPAWN_Y);
    expect(s.player.invuln).toBe(RESPAWN_INVULN);
    expect(s.events.some((e) => e.type === 'playerRespawned')).toBe(true);
  });

  function dead(s: ReturnType<typeof createGameState>) {
    s.player.alive = false;
    s.player.respawnTimer = 0;
  }

  it('respawns away from enemies that gathered at the death point', () => {
    const s = createGameState(1);
    dead(s);
    for (let i = 0; i < 5; i++) addEnemy(s, 'nemesite', s.baseX + i * 40, 300);
    updateRespawn(s, 0.1);
    expect(s.player.alive).toBe(true);
    for (const e of s.enemies) expect(Math.abs(shortestDx(s.player.x, e.x))).toBeGreaterThanOrEqual(WORLD_W / 4);
  });

  it('clears enemy shots near the respawn point', () => {
    const s = createGameState(1);
    dead(s);
    const x = s.baseX;
    s.shots = [
      { x: x + 100, y: 300, vx: 0, vy: 0, life: 1 },
      { x: x + VIEW_W, y: 300, vx: 0, vy: 0, life: 1 },
    ];
    updateRespawn(s, 0.1);
    expect(s.player.x).toBe(x);
    expect(s.shots).toHaveLength(1);
  });

  it('respawns at baseX when there are no enemies', () => {
    const s = createGameState(1);
    dead(s);
    s.player.x = 123;
    updateRespawn(s, 0.1);
    expect(s.player.x).toBe(s.baseX);
  });

  it('does not respawn after game over', () => {
    const s = createGameState(1);
    s.player.alive = false;
    s.player.respawnTimer = 0;
    s.phase = 'gameOver';
    updateRespawn(s, 1);
    expect(s.player.alive).toBe(false);
  });
});
