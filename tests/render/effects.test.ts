import { describe, it, expect } from 'vitest';
import { Effects, MAX_PARTICLES } from '../../src/render/effects';
import { createGameState } from '../../src/game/state';
import type { GameEvent } from '../../src/game/events';

const s = createGameState(1);
const explosion: GameEvent = { type: 'explosion', x: 1000, y: 300, source: 'snatcher', big: false };

describe('Effects', () => {
  it('explosions spawn particles and add trauma (screen shake)', () => {
    const fx = new Effects();
    fx.consume([explosion], s);
    expect(fx.activeParticleCount()).toBeGreaterThan(10);
    expect(fx.trauma).toBeGreaterThan(0);
    fx.update(0.01, s);
    const sh = fx.shake();
    expect(Math.abs(sh.x) + Math.abs(sh.y)).toBeGreaterThan(0);
  });

  it('particles expire and trauma decays', () => {
    const fx = new Effects();
    fx.consume([explosion], s);
    for (let i = 0; i < 200; i++) fx.update(0.016, { ...s, player: { ...s.player, thrusting: false } });
    expect(fx.activeParticleCount()).toBe(0);
    expect(fx.trauma).toBe(0);
    expect(fx.shake()).toEqual({ x: 0, y: 0 });
  });

  it('caps the particle pool', () => {
    const fx = new Effects();
    const many: GameEvent[] = Array.from({ length: 200 }, () => ({ ...explosion, big: true }));
    fx.consume(many, s);
    expect(fx.activeParticleCount()).toBeLessThanOrEqual(MAX_PARTICLES);
  });

  it('player death triggers temporary slow motion', () => {
    const fx = new Effects();
    fx.consume([{ type: 'playerDied', x: 1000, y: 300 }], s);
    expect(fx.timeScale()).toBeLessThan(1);
    fx.update(1, s);
    expect(fx.timeScale()).toBe(1);
  });

  it('smart bomb triggers a screen flash that fades', () => {
    const fx = new Effects();
    fx.consume([{ type: 'bombDetonated', x: 1000, y: 300 }], s);
    expect(fx.flash).toBeGreaterThan(0);
    fx.update(1, s);
    expect(fx.flash).toBe(0);
  });

  it('thrusting emits exhaust particles', () => {
    const fx = new Effects();
    const thrusting = { ...s, player: { ...s.player, thrusting: true } };
    fx.update(0.016, thrusting);
    expect(fx.activeParticleCount()).toBeGreaterThan(0);
  });

  it('reset clears everything', () => {
    const fx = new Effects();
    fx.consume([explosion, { type: 'bombDetonated', x: 0, y: 0 }], s);
    fx.reset();
    expect(fx.activeParticleCount()).toBe(0);
    expect(fx.flash).toBe(0);
    expect(fx.trauma).toBe(0);
  });
});
