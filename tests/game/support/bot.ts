import { NO_ACTIONS, type Actions } from '../../../src/core/input';
import { shortestDx, VIEW_W } from '../../../src/core/world';
import type { GameState, Enemy } from '../../../src/game/state';
import { BASE_GROUND_Y, groundYAt } from '../../../src/game/terrain';
import { CEILING_Y } from '../../../src/game/constants';

function steer(s: GameState, tx: number, ty: number, stopDist = 0): Pick<Actions,'moveX'|'moveY'> {
  const p = s.player;
  const dx = shortestDx(p.x, tx);
  const dy = ty - p.y;
  // simple PD
  const wantVx = Math.max(-700, Math.min(700, (Math.abs(dx) > stopDist ? dx - Math.sign(dx)*stopDist : 0) * 3));
  const wantVy = Math.max(-450, Math.min(450, dy * 4));
  const mx = Math.max(-1, Math.min(1, (wantVx - p.vx) / 150));
  const my = Math.max(-1, Math.min(1, (wantVy - p.vy) / 150 - 0.06));
  return { moveX: mx, moveY: my };
}

/** Threat level: anything lethal near the player in the next ~0.3s. */
function danger(s: GameState): boolean {
  const p = s.player;
  const T = 0.25;
  const near = (x: number, y: number, vx: number, vy: number, r: number) => {
    for (let t = 0; t <= T; t += 0.05) {
      const dx = shortestDx(p.x + p.vx * t, x + vx * t);
      const dy = (y + vy * t) - (p.y + p.vy * t);
      if (dx*dx + dy*dy < (r + 16) ** 2) return true;
    }
    return false;
  };
  for (const e of s.enemies) if (!e.dead && near(e.x, e.y, e.vx, e.vy, e.radius)) return true;
  for (const sh of s.shots) if (near(sh.x, sh.y, sh.vx, sh.vy, 3)) return true;
  for (const m of s.magma) if (near(m.x, m.y, m.vx, m.vy, m.r)) return true;
  for (const a of s.acid) if (near(a.x, a.y, 0, a.vy, 4)) return true;
  for (const b of s.eyeBombs) if (near(b.x, b.y, 0, b.vy, 5)) return true;
  for (const b of s.bolts) if (Math.abs(shortestDx(b.x, p.x)) < 30) return true;
  for (const e of s.enemies) if (e.kind === 'blunderstorm' && e.boltTimer > 0 && Math.abs(shortestDx(e.x, p.x)) < 40) return true;
  return false;
}

export interface BotStats { cloaks: number; bombs: number; }

export function bot(s: GameState, tick: number, st: BotStats, opts: { useCloak: boolean; useBomb: boolean }): Actions {
  const p = s.player;
  const a: Actions = { ...NO_ACTIONS };
  if (!p.alive) return a;
  const onScreen = s.enemies.filter((e) => !e.dead && Math.abs(shortestDx(p.x, e.x)) < VIEW_W / 2);
  // Bomb when crowded or nmeye on screen.
  if (opts.useBomb && s.bombs > 0 && tick % 30 === 0) {
    const nonAndroid = onScreen.filter((e) => e.kind !== 'android');
    if (nonAndroid.length >= 4 || nonAndroid.some((e) => e.kind === 'nmeye')) { a.bomb = true; st.bombs++; }
  }
  if (opts.useCloak && danger(s) && s.shieldBank > 0.2) { a.cloak = true; st.cloaks++; }

  // Priority: carrying -> base.
  if (p.carryingId !== null) {
    const m = steer(s, s.baseX, BASE_GROUND_Y - 40);
    Object.assign(a, m);
  } else {
    const endangered = s.men.filter((m) => m.state === 'chased' || m.state === 'falling');
    const walking = s.men.filter((m) => m.state === 'walking');
    const enemies = s.enemies.filter((e) => !e.dead);
    const dist = (x: number) => Math.abs(shortestDx(p.x, x));
    let target: { x: number; y: number; kind: 'man' | 'enemy'; e?: Enemy } | null = null;
    if (endangered.length) {
      const m = endangered.reduce((b, c) => (dist(c.x) < dist(b.x) ? c : b));
      target = { x: m.x, y: m.y, kind: 'man' };
    } else if (enemies.length) {
      // nearest enemy, prefer non-android
      const pref = enemies.reduce((b, c) => (dist(c.x) < dist(b.x) ? c : b));
      target = { x: pref.x, y: pref.y, kind: 'enemy', e: pref };
    } else if (walking.length) {
      const m = walking.reduce((b, c) => (dist(c.x) < dist(b.x) ? c : b));
      target = { x: m.x, y: m.y, kind: 'man' };
    }
    if (target) {
      if (target.kind === 'man') {
        Object.assign(a, steer(s, target.x, target.y));
      } else {
        const e = target.e!;
        const dx = shortestDx(p.x, e.x);
        const ty = Math.min(groundYAt(s.terrain, p.x) - 14, Math.max(CEILING_Y, e.y));
        Object.assign(a, steer(s, e.x, ty, 260));
        if (Math.abs(dx) < 300 && Math.abs(dx) > 120) a.moveX = 0.3 * Math.sign(dx);
        if (Math.abs(dx) <= 120) a.moveX = -Math.sign(dx);
        // face target: if moving away keep facing via small tap
        const facing = p.facing;
        if (Math.sign(dx) !== facing && Math.abs(dx) < 400) a.moveX = Math.sign(dx);
      }
    }
  }
  // Fire whenever an enemy is roughly level and in front.
  for (const e of s.enemies) {
    if (e.dead) continue;
    const dx = shortestDx(p.x, e.x);
    if (Math.sign(dx) === p.facing && Math.abs(dx) < 950 && Math.abs(e.y - p.y) < e.radius + 4) { a.fire = true; break; }
  }
  return a;
}
