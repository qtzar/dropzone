import { CAMERA_LEAD, wrapX, shortestDx } from '../core/world';

export { CAMERA_LEAD };

export interface Camera {
  /** World x at the horizontal centre of the screen. */
  x: number;
  lead: number;
}

const LEAD_RATE = 2.5;
const FOLLOW_RATE = 8;

export function createCamera(x: number): Camera {
  return { x: wrapX(x), lead: 0 };
}

export function updateCamera(cam: Camera, targetX: number, facing: 1 | -1, dt: number): void {
  cam.lead += (facing * CAMERA_LEAD - cam.lead) * Math.min(1, dt * LEAD_RATE);
  const target = wrapX(targetX + cam.lead);
  cam.x = wrapX(cam.x + shortestDx(cam.x, target) * Math.min(1, dt * FOLLOW_RATE));
}
