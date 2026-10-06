import { VIEW_W, SCANNER_H, toScreenX } from '../core/world';
import type { GameState } from '../game/state';
import { MAN_RADIUS, PLAYER_RADIUS } from '../game/constants';

const DEBUG_COLOR = '#7cfc00';

export function drawDebug(ctx: CanvasRenderingContext2D, s: GameState, camX: number, fps: number, particles: number): void {
  const aliveMen = s.men.filter((m) => m.state !== 'dead' && m.state !== 'saved').length;
  const lines = [
    `FPS ${fps.toFixed(0)}`,
    `SEED ${s.seed}`,
    `WAVE ${s.wave}  T ${s.waveTime.toFixed(1)}`,
    `ENEMIES ${s.enemies.length}`,
    `SHOTS ${s.shots.length}  HAZARDS ${s.magma.length + s.acid.length + s.bolts.length + s.eyeBombs.length}`,
    `MEN ${aliveMen}/${s.men.length}  SAVED ${s.savedThisWave}  NEXT ${s.survivors}`,
    `SHIELD ${s.shieldBank.toFixed(1)}  BOMBS ${s.bombs}`,
    `PARTICLES ${particles}`,
    `MULT x${s.multiplier}  UNSTABLE ${s.unstable}`,
  ];
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = DEBUG_COLOR;
  lines.forEach((l, i) => ctx.fillText(l, 12, SCANNER_H + 20 + i * 15));

  ctx.strokeStyle = DEBUG_COLOR;
  ctx.lineWidth = 1;
  const circle = (x: number, y: number, r: number) => {
    const sx = toScreenX(x, camX);
    if (sx < -50 || sx > VIEW_W + 50) return;
    ctx.beginPath();
    ctx.arc(sx, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  for (const e of s.enemies) circle(e.x, e.y, e.radius);
  for (const m of s.men) if (m.state !== 'dead' && m.state !== 'saved') circle(m.x, m.y, MAN_RADIUS);
  if (s.player.alive) circle(s.player.x, s.player.y, PLAYER_RADIUS * 0.8);
}
