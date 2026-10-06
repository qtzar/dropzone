import { createView } from './render/canvas';
import { InputManager } from './core/input';
import { startLoop } from './core/loop';
import { SIM_DT } from './game/constants';
import { CanvasRenderer } from './render/renderer';
import { App } from './scenes/app';

const canvas = document.getElementById('game') as HTMLCanvasElement;
let stop: (() => void) | null = null;

function showError(message: string): void {
  if (stop) stop();
  stop = null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(30,0,0,0.92)';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px monospace';
  ctx.fillText('Dropzone hit an error and stopped:', 24, 40);
  ctx.fillStyle = '#ff8a8a';
  ctx.fillText(message.slice(0, 200), 24, 70);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Reload the page to try again.', 24, 100);
}

window.addEventListener('error', (e) => showError(e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => showError(String(e.reason)));

try {
  const view = createView(canvas);
  const app = new App(new CanvasRenderer(view), new InputManager(window));

  const unlock = () => app.unlockAudio();
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) app.pause();
  });
  window.addEventListener('blur', () => app.pause());

  stop = startLoop(
    {
      step: (dt) => app.step(dt),
      render: (alpha, frameDt) => app.frame(alpha, frameDt),
      timeScale: () => app.timeScale(),
    },
    SIM_DT,
  );
} catch (err) {
  showError(err instanceof Error ? err.message : String(err));
}
