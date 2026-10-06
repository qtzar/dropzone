import { describe, it, expect } from 'vitest';
import { App, GAME_OVER_TIME, type AppRenderer, type InputSource } from '../../src/scenes/app';
import { NO_ACTIONS, type Actions } from '../../src/core/input';
import { SIM_DT } from '../../src/game/constants';
import type { KeyValueStore } from '../../src/storage/scores';

/** A 2D context stand-in whose every method is a no-op (screens never use gradients). */
const noopCtx = new Proxy(
  {},
  {
    get: (_t, prop) => (prop === 'measureText' ? () => ({ width: 0 }) : () => undefined),
    set: () => true,
  },
) as unknown as CanvasRenderingContext2D;

const fakeRenderer: AppRenderer = { ctx: noopCtx, render: () => undefined };

class FakeInput implements InputSource {
  next: Actions = NO_ACTIONS;
  poll(): Actions {
    const a = this.next;
    this.next = { ...NO_ACTIONS, moveX: a.moveX, moveY: a.moveY, fire: a.fire, cloak: a.cloak };
    return a;
  }
}

function memoryStore(): KeyValueStore {
  const data: Record<string, string> = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

function setup() {
  const input = new FakeInput();
  const app = new App(fakeRenderer, input, memoryStore());
  const press = (a: Partial<Actions>) => {
    input.next = { ...NO_ACTIONS, ...a };
    app.frame(0, 1 / 60);
    app.step(SIM_DT);
  };
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += SIM_DT) app.step(SIM_DT);
  };
  return { app, input, press, run };
}

describe('App scenes', () => {
  it('starts on the title with the attract demo running', () => {
    const { app, run } = setup();
    expect(app.scene).toBe('title');
    const t0 = app.game.time;
    run(0.5);
    expect(app.game.time).toBeGreaterThan(t0);
  });

  it('confirm on the title starts a fresh game', () => {
    const { app, press } = setup();
    press({ confirm: true });
    expect(app.scene).toBe('playing');
    expect(app.game.wave).toBe(1);
    expect(app.game.score).toBe(0);
  });

  it('pause freezes the game and resumes', () => {
    const { app, press, run } = setup();
    press({ confirm: true });
    press({ pause: true });
    expect(app.scene).toBe('paused');
    const t = app.game.time;
    run(0.5);
    expect(app.game.time).toBe(t);
    press({ pause: true });
    expect(app.scene).toBe('playing');
  });

  it('pause() only pauses while playing', () => {
    const { app, press } = setup();
    app.pause();
    expect(app.scene).toBe('title');
    press({ confirm: true });
    app.pause();
    expect(app.scene).toBe('paused');
  });

  it('a qualifying game over leads to initials entry and saves the score', () => {
    const { app, press, run } = setup();
    press({ confirm: true });
    app.game.score = 999999;
    app.game.phase = 'gameOver';
    app.step(SIM_DT);
    expect(app.scene).toBe('gameOver');
    run(GAME_OVER_TIME + 0.1);
    expect(app.scene).toBe('enterInitials');
    press({ menuY: -1 }); // A -> B
    press({ confirm: true });
    press({ confirm: true });
    press({ confirm: true });
    expect(app.scene).toBe('title');
    expect(app.highScores[0]).toEqual({ initials: 'BAA', score: 999999, wave: 1 });
  });

  it('a non-qualifying game over returns to the title', () => {
    const { app, press, run } = setup();
    press({ confirm: true });
    app.game.score = 0;
    app.game.phase = 'gameOver';
    app.step(SIM_DT);
    run(GAME_OVER_TIME + 0.1);
    expect(app.scene).toBe('title');
  });

  it('a bomb press is not lost on frames without a sim step', () => {
    const { app, input, press } = setup();
    press({ confirm: true });
    const bombs = app.game.bombs;
    input.next = { ...NO_ACTIONS, bomb: true };
    app.frame(0, 1 / 240); // no step this frame
    app.frame(0, 1 / 240); // bomb no longer held
    app.step(SIM_DT);
    expect(app.game.bombs).toBe(bombs - 1);
  });

  it('adjusts and persists audio settings', () => {
    const { app, press } = setup();
    const before = app.settings.musicVolume;
    press({ musicDelta: 1, mute: true });
    expect(app.settings.musicVolume).toBeCloseTo(Math.min(1, before + 0.1));
    expect(app.settings.muted).toBe(true);
  });

  it('F3 toggles the debug overlay', () => {
    const { app, press } = setup();
    press({ debug: true });
    expect(app.debugEnabled).toBe(true);
    press({ debug: true });
    expect(app.debugEnabled).toBe(false);
  });
});
