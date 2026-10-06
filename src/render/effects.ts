import { VIEW_W, VIEW_H, toScreenX, wrapX } from '../core/world';
import type { GameEvent } from '../game/events';
import type { GameState } from '../game/state';
import type { FxLayer } from './renderer';
import { PALETTE, explosionColor } from './palette';

export const MAX_PARTICLES = 2000;
const SLOWMO_DURATION = 0.8;
const SLOWMO_SCALE = 0.35;
const SHAKE_MAX = 16;
const PARTICLE_GRAVITY = 120;

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
}

interface Ring { x: number; y: number; maxR: number; life: number; maxLife: number; color: string }
interface Popup { x: number; y: number; text: string; life: number; color: string }

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export class Effects implements FxLayer {
  private particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: '#fff', drag: 0,
  }));
  private next = 0;
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  private _trauma = 0;
  private _flash = 0;
  private flashColor = '#ffffff';
  private slowmo = 0;
  private time = 0;

  get trauma(): number {
    return this._trauma;
  }

  get flash(): number {
    return this._flash;
  }

  reset(): void {
    for (const p of this.particles) p.active = false;
    this.rings = [];
    this.popups = [];
    this._trauma = 0;
    this._flash = 0;
    this.slowmo = 0;
  }

  activeParticleCount(): number {
    let n = 0;
    for (const p of this.particles) if (p.active) n++;
    return n;
  }

  timeScale(): number {
    return this.slowmo > 0 ? SLOWMO_SCALE : 1;
  }

  private addTrauma(v: number): void {
    this._trauma = Math.min(1, this._trauma + v);
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, drag: number): void {
    const p = this.particles[this.next];
    this.next = (this.next + 1) % MAX_PARTICLES;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.drag = drag;
  }

  private burst(x: number, y: number, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * rand(0.3, 1);
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.4, 0.9), rand(1.5, 3.5), color, 2.5);
    }
  }

  private ring(x: number, y: number, maxR: number, color: string, life: number): void {
    this.rings.push({ x, y, maxR, life, maxLife: life, color });
  }

  private popup(x: number, y: number, text: string, color: string): void {
    this.popups.push({ x, y, text, life: 1, color });
  }

  consume(events: readonly GameEvent[], s: GameState): void {
    for (const e of events) {
      switch (e.type) {
        case 'explosion': {
          const color = explosionColor(e.source);
          this.burst(e.x, e.y, color, e.big ? 70 : 28, e.big ? 420 : 260);
          this.burst(e.x, e.y, '#ffffff', 10, 180);
          this.ring(e.x, e.y, e.big ? 120 : 60, color, 0.4);
          this.addTrauma(e.big ? 0.35 : 0.12);
          break;
        }
        case 'laserFired':
          for (let i = 0; i < 3; i++) {
            this.spawn(e.x, e.y, e.facing * rand(100, 300), rand(-40, 40), 0.1, 2, PALETTE.laser, 0);
          }
          break;
        case 'enemyShot':
          for (let i = 0; i < 4; i++) this.spawn(e.x, e.y, rand(-80, 80), rand(-80, 80), 0.15, 2, PALETTE.shot, 1);
          break;
        case 'playerDied':
          this.burst(e.x, e.y, PALETTE.player, 120, 500);
          this.ring(e.x, e.y, 200, PALETTE.player, 0.6);
          this.addTrauma(0.8);
          this.slowmo = SLOWMO_DURATION;
          break;
        case 'playerRespawned':
          this.ring(e.x, e.y, 80, PALETTE.player, 0.5);
          break;
        case 'bombDetonated':
          this._flash = 1;
          this.flashColor = '#ffffff';
          this.addTrauma(0.6);
          this.ring(e.x, e.y, 700, '#ffffff', 0.6);
          break;
        case 'scorePopup':
          this.popup(
            e.x,
            e.y - 14,
            e.multiplier > 1 ? `+${e.points} x${e.multiplier}` : `+${e.points}`,
            e.multiplier > 1 ? PALETTE.hunter : PALETTE.text,
          );
          break;
        case 'manRescued':
          this.burst(e.x, e.y, PALETTE.man, 40, 220);
          this.popup(e.x, e.y - 30, 'RESCUED', PALETTE.man);
          break;
        case 'manCaught':
          this.burst(e.x, e.y, PALETTE.man, 16, 150);
          this.popup(e.x, e.y - 30, 'CAUGHT!', PALETTE.man);
          break;
        case 'manDied':
          this.popup(e.x, e.y - 20, 'MAN LOST', PALETTE.warn);
          break;
        case 'manSnatched':
          this.ring(e.x, e.y, 30, PALETTE.snatcher, 0.3);
          break;
        case 'extraLife':
          this.popup(s.player.x, s.player.y - 40, 'EXTRA LIFE', PALETTE.player);
          break;
        case 'planetUnstable':
          this.addTrauma(0.5);
          this._flash = 0.6;
          this.flashColor = PALETTE.warn;
          break;
        case 'volcanoErupt': {
          const color = e.whiteHot ? PALETTE.hotRock : PALETTE.magma;
          for (let i = 0; i < 14; i++) {
            this.spawn(e.x, e.y, rand(-90, 90), rand(-260, -120), rand(0.4, 0.8), rand(1.5, 3), color, 1);
          }
          break;
        }
        case 'hunterSpawned':
          this.ring(e.x, e.y, 90, PALETTE.hunter, 0.5);
          break;
        case 'laserBlocked':
          this.burst(e.x, e.y, PALETTE.laser, 8, 160);
          break;
        case 'nmeyeSpawned':
          this.ring(e.x, e.y, 90, PALETTE.nmeye, 0.5);
          break;
        default:
          break;
      }
    }
  }

  update(dt: number, s: GameState): void {
    this.time += dt;
    this._trauma = Math.max(0, this._trauma - dt * 1.2);
    this._flash = Math.max(0, this._flash - dt * 2.5);
    this.slowmo = Math.max(0, this.slowmo - dt);
    const simDt = dt * this.timeScale();

    const p = s.player;
    if (p.alive && p.thrusting && !p.cloakActive) {
      for (let i = 0; i < 2; i++) {
        this.spawn(
          wrapX(p.x - p.facing * 12),
          p.y + 4,
          -p.facing * rand(60, 180) + p.vx * 0.3,
          rand(60, 160),
          0.25,
          rand(2, 3),
          i === 0 ? '#ffb347' : '#ff5e3a',
          2,
        );
      }
    }

    for (const q of this.particles) {
      if (!q.active) continue;
      q.life -= simDt;
      if (q.life <= 0) {
        q.active = false;
        continue;
      }
      const damp = Math.max(0, 1 - q.drag * simDt);
      q.vx *= damp;
      q.vy = q.vy * damp + PARTICLE_GRAVITY * simDt;
      q.x = wrapX(q.x + q.vx * simDt);
      q.y += q.vy * simDt;
    }

    for (const r of this.rings) r.life -= simDt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const pop of this.popups) {
      pop.life -= dt;
      pop.y -= 40 * dt;
    }
    this.popups = this.popups.filter((pop) => pop.life > 0);
  }

  shake(): { x: number; y: number } {
    const t = this._trauma * this._trauma;
    if (t === 0) return { x: 0, y: 0 };
    return {
      x: SHAKE_MAX * t * Math.sin(this.time * 91.3),
      y: SHAKE_MAX * t * Math.sin(this.time * 73.7 + 1.3),
    };
  }

  drawWorld(ctx: CanvasRenderingContext2D, camX: number): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const q of this.particles) {
      if (!q.active) continue;
      const sx = toScreenX(q.x, camX);
      if (sx < -10 || sx > VIEW_W + 10) continue;
      ctx.globalAlpha = q.life / q.maxLife;
      ctx.fillStyle = q.color;
      ctx.fillRect(sx - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.lineWidth = 3;
    for (const r of this.rings) {
      const sx = toScreenX(r.x, camX);
      const k = 1 - r.life / r.maxLife;
      ctx.globalAlpha = r.life / r.maxLife;
      ctx.strokeStyle = r.color;
      ctx.beginPath();
      ctx.arc(sx, r.y, Math.max(1, r.maxR * k), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    for (const pop of this.popups) {
      ctx.globalAlpha = Math.min(1, pop.life * 2);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, toScreenX(pop.x, camX), pop.y);
    }
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  drawScreen(ctx: CanvasRenderingContext2D): void {
    if (this._flash <= 0) return;
    ctx.globalAlpha = this._flash * 0.8;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
}
