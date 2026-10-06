import { VIEW_W, VIEW_H, SCANNER_H, toScreenX } from '../core/world';
import { createRng, range } from '../core/rng';
import { groundYAt, TERRAIN_STEP, BASE_GROUND_Y } from '../game/terrain';
import { BASE_WIDTH } from '../game/constants';
import { PALETTE } from './palette';

interface Star { x: number; y: number; size: number; alpha: number }
interface StarLayer { factor: number; stars: Star[] }

const MOUNTAIN_STEP = 32;
const MOUNTAIN_POINTS = 64;
const MOUNTAIN_FACTOR = 0.5;

function mod(v: number, m: number): number {
  return ((v % m) + m) % m;
}

export class Background {
  private layers: StarLayer[];
  private mountains: number[];

  constructor(seed: number) {
    const rng = createRng(seed);
    const layerDefs: Array<[number, number, number]> = [[0.05, 140, 1], [0.15, 80, 1.5], [0.3, 45, 2]];
    this.layers = layerDefs.map(([factor, count, size]) => ({
      factor,
      stars: Array.from({ length: count }, () => ({
        x: range(rng, 0, VIEW_W),
        y: range(rng, SCANNER_H, 600),
        size,
        alpha: range(rng, 0.3, 1),
      })),
    }));
    this.mountains = Array.from({ length: MOUNTAIN_POINTS }, () => range(rng, 470, 560));
  }

  drawSky(ctx: CanvasRenderingContext2D, critical: boolean): void {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, critical ? '#1a0005' : '#02010a');
    g.addColorStop(1, critical ? '#3a0010' : '#0a0630');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const n = ctx.createRadialGradient(VIEW_W * 0.7, 250, 20, VIEW_W * 0.7, 250, 420);
    n.addColorStop(0, critical ? 'rgba(255,40,80,0.12)' : 'rgba(120,60,255,0.10)');
    n.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = n;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawStars(ctx: CanvasRenderingContext2D, camX: number): void {
    ctx.fillStyle = '#ffffff';
    for (const layer of this.layers) {
      const offset = camX * layer.factor;
      for (const s of layer.stars) {
        ctx.globalAlpha = s.alpha;
        ctx.fillRect(mod(s.x - offset, VIEW_W), s.y, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  private mountainAt(mx: number): number {
    const f = mod(mx, MOUNTAIN_STEP * MOUNTAIN_POINTS) / MOUNTAIN_STEP;
    const i0 = Math.floor(f) % MOUNTAIN_POINTS;
    const i1 = (i0 + 1) % MOUNTAIN_POINTS;
    const t = f - Math.floor(f);
    return this.mountains[i0] + (this.mountains[i1] - this.mountains[i0]) * t;
  }

  drawMountains(ctx: CanvasRenderingContext2D, camX: number, critical: boolean): void {
    const origin = camX * MOUNTAIN_FACTOR - VIEW_W / 2;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let sx = 0; sx <= VIEW_W + MOUNTAIN_STEP; sx += MOUNTAIN_STEP / 2) {
      ctx.lineTo(sx, this.mountainAt(origin + sx));
    }
    ctx.lineTo(VIEW_W + MOUNTAIN_STEP, VIEW_H);
    ctx.closePath();
    ctx.fillStyle = critical ? '#1c0410' : '#0b0a2a';
    ctx.fill();
    ctx.strokeStyle = critical ? 'rgba(255,60,90,0.35)' : 'rgba(90,90,200,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawTerrain(ctx: CanvasRenderingContext2D, terrain: number[], camX: number, critical: boolean): void {
    const left = camX - VIEW_W / 2;
    const i0 = Math.floor(left / TERRAIN_STEP) - 1;
    const count = Math.ceil(VIEW_W / TERRAIN_STEP) + 3;
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < count; k++) {
      const wx = (i0 + k) * TERRAIN_STEP;
      pts.push([wx - left, groundYAt(terrain, wx)]);
    }
    const color = critical ? PALETTE.terrainCritical : PALETTE.terrain;

    // Fill under the ridge
    ctx.beginPath();
    ctx.moveTo(pts[0][0], VIEW_H);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[pts.length - 1][0], VIEW_H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 560, 0, VIEW_H);
    g.addColorStop(0, critical ? 'rgba(80,0,20,0.9)' : 'rgba(10,20,70,0.9)');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fill();

    // Wireframe verticals
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < pts.length; k++) {
      if ((i0 + k) % 4 !== 0) continue;
      ctx.moveTo(pts[k][0], pts[k][1]);
      ctx.lineTo(pts[k][0], VIEW_H);
    }
    ctx.stroke();

    // Glowing ridge: wide faint pass + thin bright pass (no shadowBlur)
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawBase(ctx: CanvasRenderingContext2D, baseX: number, camX: number, time: number): void {
    const sx = toScreenX(baseX, camX);
    if (sx < -300 || sx > VIEW_W + 300) return;
    const half = BASE_WIDTH / 2;
    const y = BASE_GROUND_Y;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);

    // Beam
    const beam = ctx.createLinearGradient(0, y, 0, y - 260);
    beam.addColorStop(0, 'rgba(25,227,195,0.18)');
    beam.addColorStop(1, 'rgba(25,227,195,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(sx - half, y - 260, BASE_WIDTH, 260);

    // Pad
    ctx.strokeStyle = PALETTE.base;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 8;
    ctx.strokeRect(sx - half, y - 8, BASE_WIDTH, 8);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - half, y - 8, BASE_WIDTH, 8);

    // Beacons
    for (const bx of [sx - half, sx + half]) {
      ctx.beginPath();
      ctx.moveTo(bx, y - 8);
      ctx.lineTo(bx, y - 40);
      ctx.stroke();
      ctx.globalAlpha = 0.4 + 0.6 * pulse;
      ctx.fillStyle = PALETTE.base;
      ctx.beginPath();
      ctx.arc(bx, y - 44, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = PALETTE.base;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DROPZONE', sx, y - 20);
    ctx.textAlign = 'left';
  }
}
