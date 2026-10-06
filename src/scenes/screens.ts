import { VIEW_W, VIEW_H } from '../core/world';
import type { ScoreEntry } from '../storage/scores';
import type { AudioSettings } from '../audio/engine';
import { PALETTE } from '../render/palette';

export const INITIAL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';

/** Credit for the original game, shown on the title screen. */
export const ORIGINAL_CREDIT = 'BASED ON DROPZONE (1984) BY ARCHER MACLEAN - ATARI 8-BIT / COMMODORE 64';
export const TRIBUTE_NOTE = 'AN UNOFFICIAL FAN TRIBUTE';

const CONTROLS = [
  'ARROWS / WASD   FLY',
  'SPACE / J       FIRE',
  'B / K           SMART BOMB',
  'C / L           CLOAK (HOLD)',
  'P / ESC         PAUSE',
  '',
  'GAMEPAD  STICK FLY  A FIRE',
  'B BOMB  X CLOAK  START PAUSE',
];

function glowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void {
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = size / 5;
  ctx.strokeText(text, x, y);
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = size / 10;
  ctx.strokeText(text, x, y);
  ctx.globalAlpha = 1;
  ctx.fillText(text, x, y);
}

function dim(ctx: CanvasRenderingContext2D, alpha: number): void {
  ctx.fillStyle = `rgba(0,0,10,${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function bar(value: number): string {
  const n = Math.round(value * 10);
  return '#'.repeat(n) + '.'.repeat(10 - n);
}

export function drawTitle(ctx: CanvasRenderingContext2D, scores: readonly ScoreEntry[], time: number, settings: AudioSettings): void {
  dim(ctx, 0.55);
  glowText(ctx, 'DROPZONE', VIEW_W / 2, 200, 96, PALETTE.player);
  glowText(ctx, 'RESCUE THE MEN  -  DESTROY THE ALIENS', VIEW_W / 2, 245, 18, PALETTE.hud);
  if (Math.floor(time * 2) % 2 === 0) {
    glowText(ctx, 'PRESS ENTER / SPACE / START', VIEW_W / 2, 310, 22, PALETTE.gold);
  }

  glowText(ctx, 'HIGH SCORES', VIEW_W / 2, 370, 20, PALETTE.man);
  ctx.font = '16px monospace';
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'center';
  scores.slice(0, 10).forEach((e, i) => {
    const line = `${String(i + 1).padStart(2, ' ')}. ${e.initials.padEnd(3, ' ')}  ${String(e.score).padStart(8, '0')}  W${e.wave}`;
    ctx.fillText(line, VIEW_W / 2, 400 + i * 22);
  });

  ctx.font = '13px monospace';
  ctx.fillStyle = PALETTE.hud;
  ctx.textAlign = 'left';
  CONTROLS.forEach((line, i) => ctx.fillText(line, 40, 420 + i * 20));

  ctx.textAlign = 'right';
  ctx.fillText(`MUSIC ${bar(settings.musicVolume)}  [ ]`, VIEW_W - 40, 420);
  ctx.fillText(`SFX   ${bar(settings.sfxVolume)}  - =`, VIEW_W - 40, 440);
  ctx.fillText(`${settings.muted ? 'MUTED   ' : 'SOUND ON'}  M`, VIEW_W - 40, 460);
  ctx.fillText('DEBUG  F3', VIEW_W - 40, 480);

  ctx.textAlign = 'center';
  ctx.font = '13px monospace';
  ctx.fillStyle = PALETTE.hud;
  ctx.fillText(ORIGINAL_CREDIT, VIEW_W / 2, VIEW_H - 40);
  ctx.fillText(TRIBUTE_NOTE, VIEW_W / 2, VIEW_H - 20);
  ctx.textAlign = 'left';
}

export function drawPaused(ctx: CanvasRenderingContext2D): void {
  dim(ctx, 0.5);
  glowText(ctx, 'PAUSED', VIEW_W / 2, 330, 64, PALETTE.player);
  glowText(ctx, 'PRESS P / ESC / START TO RESUME', VIEW_W / 2, 390, 18, PALETTE.hud);
  ctx.textAlign = 'left';
}

export function drawGameOver(ctx: CanvasRenderingContext2D, score: number, wave: number): void {
  dim(ctx, 0.5);
  glowText(ctx, 'GAME OVER', VIEW_W / 2, 300, 80, PALETTE.warn);
  glowText(ctx, `SCORE ${score}`, VIEW_W / 2, 370, 28, PALETTE.text);
  glowText(ctx, `REACHED WAVE ${wave}`, VIEW_W / 2, 410, 18, PALETTE.hud);
  ctx.textAlign = 'left';
}

export function drawInitials(ctx: CanvasRenderingContext2D, letters: string[], cursor: number, score: number, time: number): void {
  dim(ctx, 0.7);
  glowText(ctx, 'NEW HIGH SCORE', VIEW_W / 2, 220, 56, PALETTE.gold);
  glowText(ctx, String(score), VIEW_W / 2, 280, 32, PALETTE.text);
  letters.forEach((ch, i) => {
    const x = VIEW_W / 2 + (i - 1) * 80;
    glowText(ctx, ch === ' ' ? '_' : ch, x, 400, 64, i === cursor ? PALETTE.player : PALETTE.hud);
    if (i === cursor && Math.floor(time * 3) % 2 === 0) {
      ctx.fillStyle = PALETTE.player;
      ctx.fillRect(x - 24, 418, 48, 4);
    }
  });
  glowText(ctx, 'UP/DOWN CHANGE  -  LEFT/RIGHT MOVE  -  ENTER CONFIRM', VIEW_W / 2, 480, 16, PALETTE.hud);
  ctx.textAlign = 'left';
}
