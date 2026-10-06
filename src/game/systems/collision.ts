import { shortestDx } from '../../core/world';
import type { Laser } from '../state';

export function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = shortestDx(ax, bx);
  const dy = by - ay;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/** True if the circle intersects the horizontal segment the laser swept from prevX to x. */
export function laserHitsCircle(l: Laser, cx: number, cy: number, r: number): boolean {
  if (Math.abs(cy - l.y) > r) return false;
  const travelled = shortestDx(l.prevX, l.x);
  const d = shortestDx(l.prevX, cx);
  const lo = Math.min(0, travelled) - r;
  const hi = Math.max(0, travelled) + r;
  return d >= lo && d <= hi;
}
