import { VIEW_W, VIEW_H, SCANNER_H, toScreenX } from '../core/world';
import { createRng, range } from '../core/rng';
import { groundYAt, TERRAIN_STEP, BASE_GROUND_Y } from '../game/terrain';
import { BASE_WIDTH } from '../game/constants';
import {
  type Landscape, VOLCANO_WIDTH, LAKE_WIDTH, DITCH_WIDTH, CRATER_WIDTH,
} from '../game/landscape';
import { PALETTE } from './palette';

interface Star { x: number; y: number; size: number; alpha: number }
interface StarLayer { factor: number; stars: Star[] }

const MOUNTAIN_STEP = 32;
const MOUNTAIN_POINTS = 64;
export const STAR_FACTORS = [0.125, 0.25, 0.375] as const;
export const MOUNTAIN_FACTOR = 0.4;
export const MOUNTAIN_PERIOD = MOUNTAIN_STEP * MOUNTAIN_POINTS;

function mod(v: number, m: number): number {
  return ((v % m) + m) % m;
}

export class Background {
  private layers: StarLayer[];
  private mountains: number[];

  constructor(seed: number) {
    const rng = createRng(seed);
    const layerDefs: Array<[number, number, number]> = [[STAR_FACTORS[0], 140, 1], [STAR_FACTORS[1], 80, 1.5], [STAR_FACTORS[2], 45, 2]];
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
    const f = mod(mx, MOUNTAIN_PERIOD) / MOUNTAIN_STEP;
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

  /** Volcano craters, the ionic lake and lava ditches, drawn over the terrain ridge. */
  drawLandscape(ctx: CanvasRenderingContext2D, ls: Landscape, terrain: number[], camX: number, time: number, whiteHot: boolean): void {
    const visible = (x: number, half: number) => {
      const sx = toScreenX(x, camX);
      return sx > -half - 40 && sx < VIEW_W + half + 40 ? sx : null;
    };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Decorative craters: a faint inner arc.
    ctx.strokeStyle = PALETTE.terrain;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    for (const c of ls.craters) {
      const sx = visible(c, CRATER_WIDTH / 2);
      if (sx === null) continue;
      const y = groundYAt(terrain, c);
      ctx.beginPath();
      ctx.ellipse(sx, y - 4, CRATER_WIDTH * 0.35, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Volcano craters: a glow at each peak (white when the planet is unstable).
    for (const v of ls.volcanoes) {
      const sx = visible(v.x, VOLCANO_WIDTH / 2);
      if (sx === null) continue;
      const y = groundYAt(terrain, v.x);
      const pulse = 0.6 + 0.4 * Math.sin(time * 3 + v.x);
      const g = ctx.createRadialGradient(sx, y, 2, sx, y, 46);
      g.addColorStop(0, whiteHot ? 'rgba(255,255,255,0.9)' : 'rgba(255,170,60,0.85)');
      g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.globalAlpha = pulse;
      ctx.fillStyle = g;
      ctx.fillRect(sx - 46, y - 46, 92, 92);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = whiteHot ? PALETTE.hotRock : PALETTE.magma;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - 10, y + 2);
      ctx.lineTo(sx + 10, y + 2);
      ctx.stroke();
    }

    // Ionic lake: a shimmering liquid surface.
    const lx = visible(ls.lakeX, LAKE_WIDTH / 2);
    if (lx !== null) {
      const y = groundYAt(terrain, ls.lakeX);
      ctx.fillStyle = 'rgba(40,220,255,0.18)';
      ctx.fillRect(lx - LAKE_WIDTH / 2, y, LAKE_WIDTH, 14);
      ctx.strokeStyle = PALETTE.lake;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let dx = -LAKE_WIDTH / 2; dx <= LAKE_WIDTH / 2; dx += 8) {
        const wy = y + Math.sin(time * 4 + dx * 0.08) * 1.5;
        if (dx === -LAKE_WIDTH / 2) ctx.moveTo(lx + dx, wy);
        else ctx.lineTo(lx + dx, wy);
      }
      ctx.stroke();
    }

    // Lava ditches: a glowing pool in each dip.
    for (const d of ls.ditches) {
      const sx = visible(d, DITCH_WIDTH / 2);
      if (sx === null) continue;
      const y = groundYAt(terrain, d);
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 6 + d);
      ctx.fillStyle = PALETTE.magma;
      ctx.beginPath();
      ctx.moveTo(sx - DITCH_WIDTH / 4, y - 14);
      ctx.lineTo(sx + DITCH_WIDTH / 4, y - 14);
      ctx.lineTo(sx, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
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
