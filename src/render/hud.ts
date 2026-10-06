import { VIEW_W, VIEW_H, WORLD_W, SCANNER_H, shortestDx, clamp } from '../core/world';
import type { GameState } from '../game/state';
import { CEILING_Y, COMBO_WINDOW, MAX_BOMBS } from '../game/constants';
import { groundYAt } from '../game/terrain';
import { isInvasionWave } from '../game/tuning';
import { PALETTE } from './palette';

export const SCANNER = { x: 240, y: 8, w: 800, h: 64 } as const;

export function scannerPos(wx: number, wy: number, camX: number): { x: number; y: number } {
  const x = SCANNER.x + SCANNER.w / 2 + shortestDx(camX, wx) * (SCANNER.w / WORLD_W);
  const t = clamp((wy - CEILING_Y) / (VIEW_H - CEILING_Y), 0, 1);
  return { x, y: SCANNER.y + 4 + t * (SCANNER.h - 8) };
}

/** World-x offsets (relative to the camera) for the scanner's mini-terrain, left to right, never hitting the ambiguous -WORLD_W/2 point. */
export function scannerTerrainOffsets(step: number): number[] {
  const out: number[] = [];
  for (let dx = -WORLD_W / 2 + step; dx <= WORLD_W / 2; dx += step) out.push(dx);
  return out;
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
  ctx.strokeStyle = s.unstable ? PALETTE.terrainUnstable : PALETTE.terrain;
  ctx.beginPath();
  const step = 128;
  const offsets = scannerTerrainOffsets(step);
  for (let i = 0; i < offsets.length; i++) {
    const dx = offsets[i];
    const p = scannerPos(camX + dx, groundYAt(s.terrain, camX + dx), camX);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // Base: a white cross
  const b = scannerPos(s.baseX, VIEW_H - 40, camX);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(b.x - 4, b.y - 1, 8, 2);
  ctx.fillRect(b.x - 1, b.y - 4, 2, 8);

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

export type TrackerColor = 'onPlanet' | 'danger' | 'safe' | 'dead';

export const TRACKER_COLORS: Record<TrackerColor, string> = {
  onPlanet: '#3d8bff',
  danger: '#ffd23d',
  safe: '#4dff88',
  dead: '#ff3b3b',
};

/** One entry per man in spawn order: on the planet, in danger (chased/falling), safe, or dead. */
export function menTracker(s: GameState): TrackerColor[] {
  return s.men.map((m): TrackerColor => {
    switch (m.state) {
      case 'saved':
        return 'safe';
      case 'dead':
        return 'dead';
      case 'chased':
      case 'falling':
        return 'danger';
      case 'walking':
      case 'carried':
        return 'onPlanet';
    }
  });
}

const TRACKER_X = 132;
const TRACKER_Y = 34;
const TRACKER_STEP = 11;

/** Row of stick-man icons to the right of the score. */
function drawMenTracker(ctx: CanvasRenderingContext2D, s: GameState): void {
  const colors = menTracker(s);
  if (colors.length === 0) {
    ctx.fillStyle = 'rgba(154,216,255,0.4)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('NO SCIENTISTS', TRACKER_X, TRACKER_Y + 4);
    return;
  }
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  colors.forEach((c, i) => {
    const x = TRACKER_X + 4 + i * TRACKER_STEP;
    const y = TRACKER_Y;
    ctx.strokeStyle = TRACKER_COLORS[c];
    ctx.fillStyle = TRACKER_COLORS[c];
    ctx.beginPath();
    ctx.arc(x, y - 7, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 2);
    ctx.moveTo(x - 3, y - 3);
    ctx.lineTo(x + 3, y - 3);
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x - 2.5, y + 7);
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + 2.5, y + 7);
    ctx.stroke();
  });
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
  ctx.fillStyle = s.multiplier > 1 ? PALETTE.gold : PALETTE.hud;
  ctx.fillText(`x${s.multiplier}`, 16, 66);
  if (s.multiplier > 1) {
    ctx.fillRect(56, 60, 80 * clamp(s.comboTimer / COMBO_WINDOW, 0, 1), 4);
  }
  ctx.fillStyle = PALETTE.hud;
  ctx.font = '12px monospace';
  ctx.fillText(`WAVE ${s.wave}`, 150, 66);
  drawMenTracker(ctx, s);
}

/** HUD text for the shield bank, e.g. "SHIELD 12.4s". */
export function shieldLabel(bank: number): string {
  return `SHIELD ${bank.toFixed(1)}s`;
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
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < MAX_BOMBS; i++) {
    ctx.beginPath();
    ctx.arc(x0 + 110 + i * 11, 18, 4, 0, Math.PI * 2);
    if (i < s.bombs) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fill();
    }
    ctx.stroke();
  }
  ctx.font = '12px monospace';
  ctx.fillStyle = s.player.cloakActive ? PALETTE.player : PALETTE.hud;
  ctx.fillText(shieldLabel(s.shieldBank), x0, 44);
  meter(ctx, x0, 66, 200, s.player.heat, s.player.overheated ? PALETTE.warn : PALETTE.trailer, s.player.overheated ? 'OVERHEAT' : 'HEAT');
}

/** Seconds the wave-start banner stays up. */
export const BANNER_TIME = 3;

/** Banner shown at the start of a wave: "TRAILER INVASION" for invasions, otherwise "WAVE n". */
export function waveBanner(s: GameState): string | null {
  if (s.phase !== 'playing' || s.waveTime >= BANNER_TIME) return null;
  return isInvasionWave(s.wave) ? 'TRAILER INVASION' : `WAVE ${s.wave}`;
}

function drawCenterMessages(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.textAlign = 'center';
  const banner = waveBanner(s);
  if (banner !== null && (banner.startsWith('WAVE') || Math.floor(s.time * 4) % 2 === 0)) {
    ctx.fillStyle = banner.startsWith('WAVE') ? PALETTE.text : PALETTE.trailer;
    ctx.font = 'bold 36px monospace';
    ctx.fillText(banner, VIEW_W / 2, 260);
  }
  if (s.unstable && Math.floor(s.time * 3) % 2 === 0) {
    ctx.fillStyle = PALETTE.warn;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('PLANET UNSTABLE', VIEW_W / 2, SCANNER_H + 36);
  }
  if (s.phase === 'waveComplete') {
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 40px monospace';
    ctx.fillText(`WAVE ${s.wave} COMPLETE`, VIEW_W / 2, 300);
    ctx.font = '20px monospace';
    ctx.fillStyle = PALETTE.man;
    ctx.fillText(`SCIENTISTS SAVED  ${s.savedThisWave}`, VIEW_W / 2, 350);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`BONUS  ${s.lastWaveBonus}`, VIEW_W / 2, 384);
  }
  ctx.textAlign = 'left';
}

export function drawHud(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
  ctx.save();
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
  ctx.restore();
}
