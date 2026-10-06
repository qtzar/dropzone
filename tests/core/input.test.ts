import { describe, it, expect } from 'vitest';
import {
  keyboardButtons, gamepadButtons, buildActions, consumeEdges, NO_ACTIONS, type Button, type PadSnapshot,
} from '../../src/core/input';

function pad(axes: number[], pressed: number[] = [], values: Record<number, number> = {}): PadSnapshot {
  const buttons = Array.from({ length: 17 }, (_, i) => ({
    pressed: pressed.includes(i),
    value: values[i] ?? (pressed.includes(i) ? 1 : 0),
  }));
  return { axes, buttons };
}

describe('keyboardButtons', () => {
  it('maps arrows and WASD', () => {
    expect(keyboardButtons(new Set(['ArrowLeft']))).toEqual(new Set(['left']));
    expect(keyboardButtons(new Set(['KeyD', 'KeyW']))).toEqual(new Set(['right', 'up']));
  });

  it('maps action keys, including multi-role Space', () => {
    expect(keyboardButtons(new Set(['Space']))).toEqual(new Set(['fire', 'confirm']));
    expect(keyboardButtons(new Set(['KeyB', 'KeyC']))).toEqual(new Set(['bomb', 'cloak']));
    expect(keyboardButtons(new Set(['Escape']))).toEqual(new Set(['pause']));
  });

  it('ignores unbound keys', () => {
    expect(keyboardButtons(new Set(['KeyZ'])).size).toBe(0);
  });
});

describe('gamepadButtons', () => {
  it('applies the deadzone to the left stick', () => {
    const g = gamepadButtons(pad([0.1, -0.2]));
    expect(g.x).toBe(0);
    expect(g.y).toBe(0);
  });

  it('rescales stick input outside the deadzone', () => {
    const g = gamepadButtons(pad([1, -1]));
    expect(g.x).toBeCloseTo(1);
    expect(g.y).toBeCloseTo(-1);
  });

  it('maps face buttons, trigger and d-pad', () => {
    expect(gamepadButtons(pad([0, 0], [0])).buttons).toEqual(new Set(['fire', 'confirm']));
    expect(gamepadButtons(pad([0, 0], [1])).buttons).toEqual(new Set(['bomb']));
    expect(gamepadButtons(pad([0, 0], [2])).buttons).toEqual(new Set(['cloak']));
    expect(gamepadButtons(pad([0, 0], [], { 7: 0.8 })).buttons).toEqual(new Set(['fire']));
    expect(gamepadButtons(pad([0, 0], [14])).buttons).toEqual(new Set(['left']));
  });

  it('adds digital directions when the stick is pushed far (for menus)', () => {
    expect(gamepadButtons(pad([-0.9, 0])).buttons.has('left')).toBe(true);
  });
});

describe('buildActions', () => {
  const none = new Set<Button>();

  it('computes digital movement', () => {
    const a = buildActions(new Set<Button>(['left', 'down']), none, 0, 0);
    expect(a.moveX).toBe(-1);
    expect(a.moveY).toBe(1);
  });

  it('prefers analog movement when present', () => {
    const a = buildActions(new Set<Button>(['right']), none, 0.4, 0);
    expect(a.moveX).toBe(0.4);
  });

  it('treats fire and cloak as held', () => {
    const held = new Set<Button>(['fire', 'cloak']);
    const a = buildActions(held, held, 0, 0);
    expect(a.fire).toBe(true);
    expect(a.cloak).toBe(true);
  });

  it('treats bomb/pause/confirm as edge-triggered', () => {
    const held = new Set<Button>(['bomb', 'pause', 'confirm']);
    expect(buildActions(held, none, 0, 0).bomb).toBe(true);
    const again = buildActions(held, held, 0, 0);
    expect(again.bomb).toBe(false);
    expect(again.pause).toBe(false);
    expect(again.confirm).toBe(false);
  });

  it('produces edge-triggered menu and volume deltas', () => {
    const a = buildActions(new Set<Button>(['up', 'sfxUp', 'musicDown']), none, 0, 0);
    expect(a.menuY).toBe(-1);
    expect(a.sfxDelta).toBe(1);
    expect(a.musicDelta).toBe(-1);
  });
});

describe('consumeEdges', () => {
  it('clears edge fields but keeps held fields', () => {
    const a = { ...NO_ACTIONS, moveX: 1, fire: true, bomb: true, pause: true, menuX: 1 as const };
    const c = consumeEdges(a);
    expect(c.moveX).toBe(1);
    expect(c.fire).toBe(true);
    expect(c.bomb).toBe(false);
    expect(c.pause).toBe(false);
    expect(c.menuX).toBe(0);
  });
});
