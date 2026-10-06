import { VIEW_W, toScreenX, lerpWrapped } from '../core/world';
import type { GameState } from '../game/state';
import { TRAIL_LIFE, TRAIL_RADIUS } from '../game/constants';
import type { View } from './canvas';
import type { Camera } from './camera';
import { Background } from './background';
import { createSprites, drawSprite, type Sprite, type SpriteKey } from './sprites';
import { PALETTE } from './palette';
import { drawHud } from './hud';

export interface FxLayer {
  shake(): { x: number; y: number };
  drawWorld(ctx: CanvasRenderingContext2D, camX: number): void;
  drawScreen(ctx: CanvasRenderingContext2D): void;
}

export interface Renderer {
  render(s: GameState, cam: Camera, alpha: number, fx?: FxLayer): void;
}

export function onScreen(sx: number, margin: number): boolean {
  return sx > -margin && sx < VIEW_W + margin;
}

export class CanvasRenderer implements Renderer {
  private sprites: Record<SpriteKey, Sprite>;
  private bg = new Background(1);

  constructor(private view: View) {
    this.sprites = createSprites();
  }

  get ctx(): CanvasRenderingContext2D {
    return this.view.ctx;
  }

  render(s: GameState, cam: Camera, alpha: number, fx?: FxLayer): void {
    const ctx = this.view.beginFrame();
    const shake = fx ? fx.shake() : { x: 0, y: 0 };

    this.bg.drawSky(ctx, s.critical);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.bg.drawStars(ctx, cam.x);
    this.bg.drawMountains(ctx, cam.x, s.critical);
    this.bg.drawTerrain(ctx, s.terrain, cam.x, s.critical);
    this.bg.drawBase(ctx, s.baseX, cam.x, s.time);

    this.drawTrails(ctx, s, cam.x);
    this.drawMen(ctx, s, cam.x);
    this.drawEnemies(ctx, s, cam.x);
    this.drawPlayer(ctx, s, cam.x, alpha);
    this.drawLasers(ctx, s, cam.x);
    this.drawShots(ctx, s, cam.x);
    if (fx) fx.drawWorld(ctx, cam.x);
    ctx.restore();

    this.drawOverlays(ctx, s, cam);
    if (fx) fx.drawScreen(ctx);
    this.view.endFrame();
  }

  /** Screen-space overlays drawn on top of the world. */
  protected drawOverlays(ctx: CanvasRenderingContext2D, s: GameState, cam: Camera): void {
    drawHud(ctx, s, cam.x);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, s: GameState, camX: number, alpha: number): void {
    const p = s.player;
    if (!p.alive) return;
    const x = lerpWrapped(p.prevX, p.x, alpha);
    const y = p.prevY + (p.y - p.prevY) * alpha;
    let a = 1;
    if (p.cloakActive) a = 0.3 + 0.15 * Math.sin(s.time * 20);
    else if (p.invuln > 0) a = Math.floor(s.time * 12) % 2 === 0 ? 0.25 : 1;
    drawSprite(ctx, this.sprites.player, toScreenX(x, camX), y, p.facing < 0, a);
  }

  private drawMen(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    for (const m of s.men) {
      if (m.state === 'saved' || m.state === 'dead') continue;
      const sx = toScreenX(m.x, camX);
      if (!onScreen(sx, 40)) continue;
      drawSprite(ctx, this.sprites.man, sx, m.y, m.dir < 0);
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    for (const e of s.enemies) {
      const sx = toScreenX(e.x, camX);
      if (!onScreen(sx, 60)) continue;
      drawSprite(ctx, this.sprites[e.kind], sx, e.y, e.vx < 0);
    }
  }

  private drawLasers(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PALETTE.laser;
    ctx.lineCap = 'round';
    for (const l of s.lasers) {
      const sx = toScreenX(l.x, camX);
      if (!onScreen(sx, 80)) continue;
      const tail = sx - Math.sign(l.vx) * 70;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(tail, l.y);
      ctx.lineTo(sx, l.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawShots(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = PALETTE.shot;
    for (const sh of s.shots) {
      const sx = toScreenX(sh.x, camX);
      if (!onScreen(sx, 20)) continue;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(sx, sh.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(sx, sh.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawTrails(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = PALETTE.trailer;
    for (const t of s.trails) {
      const sx = toScreenX(t.x, camX);
      if (!onScreen(sx, 20)) continue;
      ctx.globalAlpha = Math.max(0, t.life / TRAIL_LIFE) * 0.8;
      ctx.beginPath();
      ctx.arc(sx, t.y, TRAIL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
