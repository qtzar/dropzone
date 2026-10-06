export type Button =
  | 'left' | 'right' | 'up' | 'down'
  | 'fire' | 'bomb' | 'cloak' | 'pause' | 'confirm'
  | 'debug' | 'mute' | 'musicDown' | 'musicUp' | 'sfxDown' | 'sfxUp';

export type Tri = -1 | 0 | 1;

export interface Actions {
  moveX: number;
  moveY: number;
  // held
  fire: boolean;
  cloak: boolean;
  // edge-triggered
  bomb: boolean;
  pause: boolean;
  confirm: boolean;
  debug: boolean;
  mute: boolean;
  menuX: Tri;
  menuY: Tri;
  musicDelta: Tri;
  sfxDelta: Tri;
}

export const NO_ACTIONS: Actions = {
  moveX: 0, moveY: 0, fire: false, cloak: false,
  bomb: false, pause: false, confirm: false, debug: false, mute: false,
  menuX: 0, menuY: 0, musicDelta: 0, sfxDelta: 0,
};

/** Keyed by KeyboardEvent.code. */
export const KEY_BINDINGS: Readonly<Record<string, readonly Button[]>> = {
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  Space: ['fire', 'confirm'], KeyJ: ['fire'],
  KeyB: ['bomb'], KeyK: ['bomb'],
  KeyC: ['cloak'], KeyL: ['cloak'],
  KeyP: ['pause'], Escape: ['pause'],
  Enter: ['confirm'],
  F3: ['debug'],
  KeyM: ['mute'],
  BracketLeft: ['musicDown'], BracketRight: ['musicUp'],
  Minus: ['sfxDown'], Equal: ['sfxUp'],
};

/** Standard gamepad mapping: [button index, buttons]. */
export const PAD_BUTTONS: ReadonlyArray<readonly [number, readonly Button[]]> = [
  [0, ['fire', 'confirm']], // A
  [1, ['bomb']], // B
  [2, ['cloak']], // X
  [7, ['fire']], // RT
  [9, ['pause', 'confirm']], // Start
  [12, ['up']], [13, ['down']], [14, ['left']], [15, ['right']],
];

export const DEADZONE = 0.25;
const TRIGGER_THRESHOLD = 0.3;
const STICK_DIGITAL_THRESHOLD = 0.5;

export interface PadSnapshot {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export function keyboardButtons(down: ReadonlySet<string>): Set<Button> {
  const out = new Set<Button>();
  for (const code of down) {
    const bound = KEY_BINDINGS[code];
    if (bound) for (const b of bound) out.add(b);
  }
  return out;
}

function applyDeadzone(v: number): number {
  const m = Math.abs(v);
  if (m < DEADZONE) return 0;
  return (Math.sign(v) * (m - DEADZONE)) / (1 - DEADZONE);
}

export function gamepadButtons(pad: PadSnapshot): { buttons: Set<Button>; x: number; y: number } {
  const buttons = new Set<Button>();
  for (const [index, bound] of PAD_BUTTONS) {
    const b = pad.buttons[index];
    if (b && (b.pressed || b.value > TRIGGER_THRESHOLD)) for (const name of bound) buttons.add(name);
  }
  const rawX = pad.axes[0] ?? 0;
  const rawY = pad.axes[1] ?? 0;
  if (rawX < -STICK_DIGITAL_THRESHOLD) buttons.add('left');
  if (rawX > STICK_DIGITAL_THRESHOLD) buttons.add('right');
  if (rawY < -STICK_DIGITAL_THRESHOLD) buttons.add('up');
  if (rawY > STICK_DIGITAL_THRESHOLD) buttons.add('down');
  return { buttons, x: applyDeadzone(rawX), y: applyDeadzone(rawY) };
}

export function buildActions(
  held: ReadonlySet<Button>,
  prev: ReadonlySet<Button>,
  analogX: number,
  analogY: number,
): Actions {
  const pressed = (b: Button): boolean => held.has(b) && !prev.has(b);
  const edgeAxis = (neg: Button, pos: Button): Tri => ((pressed(pos) ? 1 : 0) - (pressed(neg) ? 1 : 0)) as Tri;
  const digitalX = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  const digitalY = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
  return {
    moveX: analogX !== 0 ? analogX : digitalX,
    moveY: analogY !== 0 ? analogY : digitalY,
    fire: held.has('fire'),
    cloak: held.has('cloak'),
    bomb: pressed('bomb'),
    pause: pressed('pause'),
    confirm: pressed('confirm'),
    debug: pressed('debug'),
    mute: pressed('mute'),
    menuX: edgeAxis('left', 'right'),
    menuY: edgeAxis('up', 'down'),
    musicDelta: edgeAxis('musicDown', 'musicUp'),
    sfxDelta: edgeAxis('sfxDown', 'sfxUp'),
  };
}

/** Copy of `a` with edge-triggered fields cleared (use after the first sim step of a frame). */
export function consumeEdges(a: Actions): Actions {
  return {
    ...a,
    bomb: false, pause: false, confirm: false, debug: false, mute: false,
    menuX: 0, menuY: 0, musicDelta: 0, sfxDelta: 0,
  };
}

export class InputManager {
  private down = new Set<string>();
  private prev = new Set<Button>();

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (KEY_BINDINGS[e.code]) e.preventDefault();
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      // macOS swallows keyups for other keys while Meta is held.
      if (e.code === 'MetaLeft' || e.code === 'MetaRight') this.down.clear();
      this.down.delete(e.code);
    });
    target.addEventListener('blur', () => this.down.clear());
  }

  poll(): Actions {
    const held = keyboardButtons(this.down);
    let ax = 0;
    let ay = 0;
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const g = gamepadButtons(p);
      for (const b of g.buttons) held.add(b);
      if (Math.abs(g.x) > Math.abs(ax)) ax = g.x;
      if (Math.abs(g.y) > Math.abs(ay)) ay = g.y;
    }
    const actions = buildActions(held, this.prev, ax, ay);
    this.prev = held;
    return actions;
  }
}
