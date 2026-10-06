import type { EnemyKind } from '../game/state';
import { PALETTE } from './palette';

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Half the sprite's size in game units. */
  half: number;
}

export type SpriteKey = EnemyKind | 'player' | 'man';

/** Sprites are rendered at 2× so they stay sharp when the game is scaled up. */
const SPRITE_SCALE = 2;
const GLOW_PAD = 20;

/**
 * Pre-renders vector line art with a layered glow. `draw` must build and stroke
 * its own paths, centred on (0, 0) and facing right.
 * This is the ONLY place shadowBlur is allowed.
 */
export function makeSprite(radius: number, color: string, draw: (ctx: CanvasRenderingContext2D) => void): Sprite {
  const size = Math.ceil((radius + GLOW_PAD) * 2);
  const canvas = document.createElement('canvas');
  canvas.width = size * SPRITE_SCALE;
  canvas.height = size * SPRITE_SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SPRITE_SCALE, SPRITE_SCALE);
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  const passes: Array<[number, number]> = [[16, 3], [6, 2], [0, 1.5]];
  for (const [blur, width] of passes) {
    ctx.shadowBlur = blur * SPRITE_SCALE;
    ctx.lineWidth = width;
    draw(ctx);
  }
  // Bright core
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 0.75;
  draw(ctx);
  return { canvas, half: size / 2 };
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  flipX = false,
  alpha = 1,
  angle = 0,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (angle !== 0) ctx.rotate(angle);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half, sprite.half * 2, sprite.half * 2);
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>): void {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function createSprites(): Record<SpriteKey, Sprite> {
  return {
    player: makeSprite(16, PALETTE.player, (c) => {
      c.beginPath();
      circle(c, 4, -9, 5); // helmet
      poly(c, [[-6, -4], [6, -4], [5, 8], [-5, 8]]); // body
      poly(c, [[-12, -5], [-7, -5], [-7, 7], [-12, 7]]); // jetpack
      line(c, -3, 8, -5, 15);
      line(c, 3, 8, 5, 15);
      line(c, 6, 0, 15, 0); // arm + gun
      c.stroke();
    }),
    man: makeSprite(10, PALETTE.man, (c) => {
      c.beginPath();
      circle(c, 0, -7, 3);
      line(c, 0, -4, 0, 4);
      line(c, -5, -3, 0, -1);
      line(c, 5, -3, 0, -1);
      line(c, 0, 4, -3, 10);
      line(c, 0, 4, 3, 10);
      c.stroke();
    }),
    snatcher: makeSprite(15, PALETTE.snatcher, (c) => {
      c.beginPath();
      poly(c, [[0, -12], [12, 0], [0, 12], [-12, 0]]);
      circle(c, 0, 0, 3);
      line(c, -6, 8, -9, 15);
      line(c, 6, 8, 9, 15);
      c.stroke();
    }),
    nemesite: makeSprite(14, PALETTE.nemesite, (c) => {
      c.beginPath();
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? 13 : 6;
        const a = (i / 16) * Math.PI * 2;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      poly(c, pts);
      circle(c, 0, 0, 2.5);
      c.stroke();
    }),
    trailer: makeSprite(14, PALETTE.trailer, (c) => {
      c.beginPath();
      poly(c, [[-12, -9], [13, 0], [-12, 9], [-6, 0]]);
      line(c, -2, -3, 6, 0);
      line(c, -2, 3, 6, 0);
      c.stroke();
    }),
    orb: makeSprite(16, PALETTE.orb, (c) => {
      c.beginPath();
      circle(c, 0, 0, 14);
      circle(c, 0, 0, 6);
      line(c, -14, 0, 14, 0);
      line(c, 0, -14, 0, 14);
      c.stroke();
    }),
    fragment: makeSprite(8, PALETTE.fragment, (c) => {
      c.beginPath();
      poly(c, [[0, -7], [6, 5], [-6, 5]]);
      c.stroke();
    }),
    hunter: makeSprite(16, PALETTE.hunter, (c) => {
      c.beginPath();
      poly(c, [[0, -15], [16, 0], [0, 15], [-16, 0]]);
      poly(c, [[0, -7], [8, 0], [0, 7], [-8, 0]]);
      line(c, -20, 0, 20, 0);
      c.stroke();
    }),
    planter: makeSprite(16, PALETTE.planter, (c) => {
      c.beginPath();
      c.moveTo(-15, 2);
      c.ellipse(0, 2, 15, 5, 0, 0, Math.PI * 2); // saucer rim
      c.moveTo(-7, -2);
      c.arc(0, -2, 7, Math.PI, 0); // dome
      line(c, 0, 7, 0, 12); // tether hook
      c.stroke();
    }),
    android: makeSprite(10, PALETTE.android, (c) => {
      c.beginPath();
      poly(c, [[-3, -9], [3, -9], [3, -4], [-3, -4]]); // head
      poly(c, [[-5, -3], [5, -3], [4, 4], [-4, 4]]); // body
      line(c, -3, 4, -5, 9);
      line(c, 3, 4, 5, 9);
      line(c, -5, -2, -8, 2);
      line(c, 5, -2, 8, 2);
      c.stroke();
    }),
    spore: makeSprite(15, PALETTE.spore, (c) => {
      c.beginPath();
      circle(c, 0, 0, 9);
      circle(c, 0, 0, 3);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        line(c, Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a) * 14, Math.sin(a) * 14);
      }
      c.stroke();
    }),
    blunderstorm: makeSprite(26, PALETTE.blunderstorm, (c) => {
      c.beginPath();
      c.moveTo(-22, 8);
      c.arc(-12, 2, 10, Math.PI * 0.75, Math.PI * 1.6);
      c.arc(2, -6, 13, Math.PI * 1.1, Math.PI * 1.9);
      c.arc(15, 2, 9, Math.PI * 1.4, Math.PI * 0.4);
      c.lineTo(-22, 8);
      line(c, -6, 12, -10, 20);
      line(c, 6, 12, 2, 20);
      c.stroke();
    }),
    nmeye: makeSprite(15, PALETTE.nmeye, (c) => {
      c.beginPath();
      c.moveTo(-14, 0);
      c.quadraticCurveTo(0, -13, 14, 0);
      c.quadraticCurveTo(0, 13, -14, 0);
      circle(c, 0, 0, 5);
      circle(c, 0, 0, 1.5);
      c.stroke();
    }),
    antimatter: makeSprite(13, PALETTE.antimatter, (c) => {
      c.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        circle(c, Math.cos(a) * 5, Math.sin(a) * 5, 6);
      }
      c.stroke();
    }),
  };
}
