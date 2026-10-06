export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WORLD_W = VIEW_W * 8;
/** Height of the scanner/HUD strip at the top of the screen. */
export const SCANNER_H = 80;
/** How far the camera leads the player in the facing direction. */
export const CAMERA_LEAD = VIEW_W * 0.18;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function wrapX(x: number): number {
  return ((x % WORLD_W) + WORLD_W) % WORLD_W;
}

/** Signed horizontal distance from `from` to `to`, taking the shortest path around the wrap. */
export function shortestDx(from: number, to: number): number {
  let d = wrapX(to - from);
  if (d > WORLD_W / 2) d -= WORLD_W;
  return d;
}

/** Screen x of a world x, with the camera centred horizontally on screen. */
export function toScreenX(worldX: number, cameraX: number): number {
  return shortestDx(cameraX, worldX) + VIEW_W / 2;
}

export function lerpWrapped(a: number, b: number, t: number): number {
  return wrapX(a + shortestDx(a, b) * t);
}
