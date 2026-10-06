import { createView } from './render/canvas';
import { InputManager, consumeEdges } from './core/input';
import { newGame } from './game/systems/waves';
import { update } from './game/update';
import { startLoop } from './core/loop';
import { SIM_DT } from './game/constants';
import { CanvasRenderer } from './render/renderer';
import { createCamera, updateCamera } from './render/camera';
import { Effects } from './render/effects';
import { lerpWrapped } from './core/world';

const view = createView(document.getElementById('game') as HTMLCanvasElement);
const input = new InputManager(window);
const state = newGame((Math.random() * 2 ** 32) >>> 0);
const camera = createCamera(state.player.x);
const renderer = new CanvasRenderer(view);
const fx = new Effects();
let actions = input.poll();

startLoop(
  {
    step(dt) {
      update(state, actions, dt);
      actions = consumeEdges(actions);
    },
    render(alpha, frameDt) {
      fx.consume(state.events, state);
      state.events.length = 0;
      fx.update(frameDt, state);
      const px = lerpWrapped(state.player.prevX, state.player.x, alpha);
      updateCamera(camera, px, state.player.facing, frameDt);
      renderer.render(state, camera, alpha, fx);
      actions = input.poll();
    },
    timeScale: () => fx.timeScale(),
  },
  SIM_DT,
);
