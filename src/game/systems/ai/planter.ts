import { shortestDx } from '../../../core/world';
import type { GameState, Enemy, Man } from '../../state';
import { emit } from '../../events';
import { groundYAt } from '../../terrain';
import { volcanoAt } from '../../landscape';
import { findMan, findEnemy } from '../../query';
import { createEnemy, convertEnemy } from '../../entities/enemies';
import { circlesOverlap } from '../collision';
import {
  BASE_WIDTH, PLANTER_RISE, PLANTER_SPOT_RANGE, TETHER_SPEED, ANDROID_CHASE_MULT, ANDROID_FALL_GRAVITY,
  MAN_WALK_SPEED, MAN_RADIUS, PLANT_GRACE,
} from '../../constants';

/** A walking man (not already chased) close enough below the Planter to drop an Android on. */
function findPlantTarget(s: GameState, e: Enemy): Man | undefined {
  return s.men.find((m) => m.state === 'walking' && Math.abs(shortestDx(e.x, m.x)) <= PLANTER_SPOT_RANGE);
}

function startLowering(s: GameState, e: Enemy, man: Man): void {
  const android = createEnemy(s, 'android', e.x, e.y + e.radius);
  android.linkedId = e.id;
  android.targetId = man.id;
  s.enemies.push(android);
  e.linkedId = android.id;
  e.tetherLen = e.radius;
  e.vx = 0;
  e.vy = 0;
  man.state = 'chased';
  man.holderId = android.id;
  emit(s, { type: 'manWhistle', x: man.x, y: man.y });
}

export function updatePlanter(s: GameState, e: Enemy, dt: number): void {
  if (e.linkedId !== null) {
    const android = findEnemy(s, e.linkedId);
    if (!android || android.linkedId !== e.id) {
      convertEnemy(s, e, 'nemesite');
      return;
    }
    e.vx = 0;
    e.vy = 0;
    e.tetherLen += TETHER_SPEED * dt;
    return;
  }
  const raised = volcanoAt(s.landscape, e.x) !== undefined || Math.abs(shortestDx(e.x, s.baseX)) <= BASE_WIDTH / 2;
  const targetY = e.homeY - (raised ? PLANTER_RISE : 0);
  e.vx = (e.vx < 0 ? -1 : 1) * e.speed;
  e.vy = (targetY - e.y) * 2;
  const man = s.waveTime < PLANT_GRACE ? undefined : findPlantTarget(s, e);
  if (man) startLowering(s, e, man);
}

function crash(s: GameState, e: Enemy): void {
  e.dead = true;
  emit(s, { type: 'explosion', x: e.x, y: e.y, source: 'android', big: false });
}

export function updateAndroid(s: GameState, e: Enemy, dt: number): void {
  const floor = groundYAt(s.terrain, e.x) - e.radius;

  if (e.falling) {
    if (e.y >= floor - 0.5) {
      crash(s, e);
      return;
    }
    e.vx = 0;
    e.vy += ANDROID_FALL_GRAVITY * dt;
    return;
  }

  if (e.linkedId !== null) {
    const planter = findEnemy(s, e.linkedId);
    if (!planter) {
      e.linkedId = null;
      e.falling = true;
      e.vy = 0;
      return;
    }
    e.x = planter.x;
    e.y = planter.y + planter.tetherLen;
    e.vx = 0;
    e.vy = 0;
    const landY = groundYAt(s.terrain, e.x) - e.radius;
    if (e.y >= landY) {
      e.y = landY;
      e.linkedId = null;
      convertEnemy(s, planter, 'nemesite');
    }
    return;
  }

  // On the ground: chase the target man, or wander once he is gone.
  e.y = floor;
  e.vy = 0;
  const target = e.targetId !== null ? findMan(s, e.targetId) : undefined;
  if (target && target.state === 'chased' && target.holderId === e.id) {
    const dx = shortestDx(e.x, target.x);
    e.vx = Math.sign(dx) * ANDROID_CHASE_MULT * MAN_WALK_SPEED;
    if (circlesOverlap(e.x, e.y, e.radius, target.x, target.y, MAN_RADIUS)) {
      target.state = 'dead';
      target.holderId = null;
      e.targetId = null;
      emit(s, { type: 'manDied', x: target.x, y: target.y });
      emit(s, { type: 'explosion', x: target.x, y: target.y, source: 'man', big: false });
    }
    return;
  }
  e.targetId = null;
  e.vx = (e.vx < 0 ? -1 : 1) * MAN_WALK_SPEED;
}
