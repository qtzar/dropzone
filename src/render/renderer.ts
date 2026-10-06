import { VIEW_W, toScreenX, lerpWrapped } from '../core/world';
import type { GameState } from '../game/state';
import { TRAIL_LIFE, TRAIL_RADIUS, ACID_RADIUS, BOLT_WIDTH, EYE_BOMB_RADIUS } from '../game/constants';
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

    this.bg.drawSky(ctx, s.unstable);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.bg.drawStars(ctx, cam.x);
    this.bg.drawMountains(ctx, cam.x, s.unstable);
    this.bg.drawTerrain(ctx, s.terrain, cam.x, s.unstable);
    this.bg.drawLandscape(ctx, s.landscape, s.terrain, cam.x, s.time, s.unstable);
    this.bg.drawBase(ctx, s.baseX, cam.x, s.time);

    this.drawTrails(ctx, s, cam.x);
    this.drawMen(ctx, s, cam.x);
    this.drawEnemies(ctx, s, cam.x);
    this.drawPlayer(ctx, s, cam.x, alpha);
    this.drawLasers(ctx, s, cam.x);
    this.drawShots(ctx, s, cam.x);
    this.drawHazards(ctx, s, cam.x);
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
      if (m.state === 'chased' && Math.floor(s.time * 6) % 2 === 0) {
        ctx.fillStyle = PALETTE.warn;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', sx, m.y - 16);
        ctx.textAlign = 'left';
      }
    }
  }

  private drawTethers(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    ctx.strokeStyle = PALETTE.planter;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    for (const e of s.enemies) {
      if (e.kind !== 'planter' || e.linkedId === null) continue;
      const sx = toScreenX(e.x, camX);
      if (!onScreen(sx, 60)) continue;
      ctx.beginPath();
      ctx.moveTo(sx, e.y + e.radius * 0.5);
      ctx.lineTo(sx, e.y + e.tetherLen);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    this.drawTethers(ctx, s, camX);
    const flash = Math.floor(s.time * 10) % 2 === 0;
    for (const e of s.enemies) {
      const sx = toScreenX(e.x, camX);
      if (!onScreen(sx, 60)) continue;
      if (e.kind === 'nmeye') {
        // The Nmeye flashes white as a warning.
        drawSprite(ctx, this.sprites.nmeye, sx, e.y, e.vx < 0, flash ? 1 : 0.6);
        if (flash) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, e.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      if (e.kind === 'trailer') {
        // Dim tail behind the bright head: only head hits kill.
        const v = Math.hypot(e.vx, e.vy) || 1;
        ctx.strokeStyle = PALETTE.trailer;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(sx, e.y);
        ctx.lineTo(sx - (e.vx / v) * 26, e.y - (e.vy / v) * 26);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const angle = e.kind === 'antimatter' ? s.time * 6 : 0;
      drawSprite(ctx, this.sprites[e.kind], sx, e.y, e.vx < 0, 1, angle);
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

  private glowDot(ctx: CanvasRenderingContext2D, sx: number, y: number, r: number, color: string): void {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(sx, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sx, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHazards(ctx: CanvasRenderingContext2D, s: GameState, camX: number): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const m of s.magma) {
      const sx = toScreenX(m.x, camX);
      if (onScreen(sx, 30)) this.glowDot(ctx, sx, m.y, m.r, m.hot ? PALETTE.hotRock : PALETTE.magma);
    }
    for (const a of s.acid) {
      const sx = toScreenX(a.x, camX);
      if (!onScreen(sx, 20)) continue;
      this.glowDot(ctx, sx, a.y, ACID_RADIUS, PALETTE.acid);
      ctx.fillRect(sx - 1, a.y - ACID_RADIUS * 3, 2, ACID_RADIUS * 2);
    }
    const flash = Math.floor(s.time * 16) % 2 === 0;
    for (const b of s.eyeBombs) {
      const sx = toScreenX(b.x, camX);
      if (onScreen(sx, 20)) this.glowDot(ctx, sx, b.y, EYE_BOMB_RADIUS, flash ? '#ffffff' : PALETTE.nmeye);
    }
    for (const b of s.bolts) {
      const sx = toScreenX(b.x, camX);
      if (!onScreen(sx, 40)) continue;
      ctx.fillStyle = PALETTE.bolt;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(sx - BOLT_WIDTH, b.top, BOLT_WIDTH * 2, b.bottom - b.top);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(sx - BOLT_WIDTH / 2, b.top, BOLT_WIDTH, b.bottom - b.top);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1.5, b.top, 3, b.bottom - b.top);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
