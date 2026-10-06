import { VIEW_W, VIEW_H, WORLD_W, SCANNER_H, shortestDx, clamp } from '../core/world';
import type { GameState } from '../game/state';
import { CEILING_Y, COMBO_WINDOW, MAX_BOMBS } from '../game/constants';
import { groundYAt } from '../game/terrain';
import { PALETTE } from './palette';

export const SCANNER = { x: 240, y: 8, w: 800, h: 64 } as const;

export function scannerPos(wx: number, wy: number, camX: number): { x: number; y: number } {
  const x = SCANNER.x + SCANNER.w / 2 + shortestDx(camX, wx) * (SCANNER.w / WORLD_W);
  const t = clamp((wy - CEILING_Y) / (VIEW_H - CEILING_Y), 0, 1);
  return { x, y: SCANNER.y + 4 + t * (SCANNER.h - 8) };
}

function blip(ctx: CanvasRenderingContext2D, s: { x: number; y: number }, color: string, size: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size);
}

function meter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, value: number, color: string, label: string): void {
  ctx.fillStyle = PALETTE.hud;
  ctx.font = '10px monospace';
  ctx.fillText(label, x, y - 3);
  ctx.strokeStyle = 'rgba(154,216,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, 6);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, (w - 2) * clamp(value, 0, 1), 4);
}

function drawScanner(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
  ctx.fillStyle = 'rgba(0,10,30,0.85)';
  ctx.fillRect(SCANNER.x, SCANNER.y, SCANNER.w, SCANNER.h);
  ctx.strokeStyle = PALETTE.hud;
  ctx.lineWidth = 1;
  ctx.strokeRect(SCANNER.x, SCANNER.y, SCANNER.w, SCANNER.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(SCANNER.x, SCANNER.y, SCANNER.w, SCANNER.h);
  ctx.clip();

  // Mini terrain
  ctx.strokeStyle = s.critical ? PALETTE.terrainCritical : PALETTE.terrain;
  ctx.beginPath();
  const step = 128;
  for (let dx = -WORLD_W / 2; dx <= WORLD_W / 2; dx += step) {
    const p = scannerPos(camX + dx, groundYAt(s.terrain, camX + dx), camX);
    if (dx === -WORLD_W / 2) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // Base
  const b = scannerPos(s.baseX, VIEW_H - 40, camX);
  blip(ctx, b, PALETTE.base, 6);

  for (const m of s.men) {
    if (m.state === 'saved' || m.state === 'dead') continue;
    blip(ctx, scannerPos(m.x, m.y, camX), PALETTE.man, 3);
  }
  for (const e of s.enemies) blip(ctx, scannerPos(e.x, e.y, camX), PALETTE[e.kind], 3);
  if (s.player.alive) blip(ctx, scannerPos(s.player.x, s.player.y, camX), PALETTE.player, 5);

  // Current view bracket
  const vw = VIEW_W * (SCANNER.w / WORLD_W);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeRect(SCANNER.x + SCANNER.w / 2 - vw / 2, SCANNER.y + 1, vw, SCANNER.h - 2);
  ctx.restore();
}

function drawLeftPanel(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hud;
  ctx.font = '11px monospace';
  ctx.fillText('SCORE', 16, 20);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 22px monospace';
  ctx.fillText(String(s.score).padStart(8, '0'), 16, 44);
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = s.multiplier > 1 ? PALETTE.hunter : PALETTE.hud;
  ctx.fillText(`x${s.multiplier}`, 16, 66);
  if (s.multiplier > 1) {
    ctx.fillRect(56, 60, 80 * (s.comboTimer / COMBO_WINDOW), 4);
  }
  ctx.fillStyle = PALETTE.hud;
  ctx.font = '12px monospace';
  ctx.fillText(`WAVE ${s.wave}`, 150, 66);
}

function drawRightPanel(ctx: CanvasRenderingContext2D, s: GameState): void {
  const x0 = 1056;
  ctx.fillStyle = PALETTE.player;
  for (let i = 0; i < Math.min(s.lives, 6); i++) {
    const x = x0 + i * 16;
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x + 6, 12);
    ctx.lineTo(x + 12, 24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = PALETTE.hunter;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < MAX_BOMBS; i++) {
    ctx.beginPath();
    ctx.arc(x0 + 110 + i * 18, 18, 6, 0, Math.PI * 2);
    if (i < s.bombs) {
      ctx.fillStyle = PALETTE.hunter;
      ctx.fill();
    }
    ctx.stroke();
  }
  meter(ctx, x0, 46, 200, s.player.cloak, PALETTE.player, 'CLOAK');
  meter(ctx, x0, 66, 200, s.player.heat, s.player.overheated ? PALETTE.warn : PALETTE.trailer, s.player.overheated ? 'OVERHEAT' : 'HEAT');
}

function drawCenterMessages(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.textAlign = 'center';
  if (s.critical && Math.floor(s.time * 3) % 2 === 0) {
    ctx.fillStyle = PALETTE.warn;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('PLANET CRITICAL', VIEW_W / 2, SCANNER_H + 36);
  }
  if (s.phase === 'waveComplete') {
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 40px monospace';
    ctx.fillText(`WAVE ${s.wave} COMPLETE`, VIEW_W / 2, 300);
    ctx.font = '20px monospace';
    ctx.fillStyle = PALETTE.man;
    ctx.fillText(`MEN SAVED  ${s.savedThisWave}`, VIEW_W / 2, 350);
    ctx.fillStyle = PALETTE.hunter;
    ctx.fillText(`BONUS  ${s.lastWaveBonus}`, VIEW_W / 2, 384);
  }
  ctx.textAlign = 'left';
}

export function drawHud(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, VIEW_W, SCANNER_H);
  ctx.strokeStyle = 'rgba(154,216,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, SCANNER_H);
  ctx.lineTo(VIEW_W, SCANNER_H);
  ctx.stroke();
  drawScanner(ctx, s, camX);
  drawLeftPanel(ctx, s);
  drawRightPanel(ctx, s);
  drawCenterMessages(ctx, s);
}
