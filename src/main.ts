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
import { AudioEngine } from './audio/engine';
import { Sfx } from './audio/sfx';
import { Music } from './audio/music';
import { createEventAudio } from './audio/eventAudio';

const view = createView(document.getElementById('game') as HTMLCanvasElement);
const input = new InputManager(window);
const state = newGame((Math.random() * 2 ** 32) >>> 0);
const camera = createCamera(state.player.x);
const renderer = new CanvasRenderer(view);
const fx = new Effects();
const audio = new AudioEngine();
const music = new Music(audio);
const playEvents = createEventAudio(new Sfx(audio), () => performance.now() / 1000);
let actions = input.poll();

const unlockAudio = () => {
  audio.unlock();
  music.start();
};
window.addEventListener('keydown', unlockAudio);
window.addEventListener('pointerdown', unlockAudio);

startLoop(
  {
    step(dt) {
      update(state, actions, dt);
      actions = consumeEdges(actions);
    },
    render(alpha, frameDt) {
      playEvents(state.events);
      fx.consume(state.events, state);
      state.events.length = 0;
      fx.update(frameDt, state);
      music.setIntensity(state.critical ? 2 : state.wave >= 5 ? 1 : 0);
      const px = lerpWrapped(state.player.prevX, state.player.x, alpha);
      updateCamera(camera, px, state.player.facing, frameDt);
      renderer.render(state, camera, alpha, fx);
      actions = input.poll();
    },
    timeScale: () => fx.timeScale(),
  },
  SIM_DT,
);
