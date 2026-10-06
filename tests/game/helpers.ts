import { allocId, type GameState, type Man, type ManState, type EnemyKind, type Enemy } from '../../src/game/state';
import { groundYAt } from '../../src/game/terrain';
import { MAN_RADIUS } from '../../src/game/constants';
import { createEnemy } from '../../src/game/entities/enemies';

export function addMan(s: GameState, x: number, state: ManState = 'walking'): Man {
  const m: Man = {
    id: allocId(s),
    x,
    y: groundYAt(s.terrain, x) - MAN_RADIUS,
    vy: 0,
    dir: 1,
    state,
    fallStartY: 0,
    holderId: null,
    walkTimer: 10,
    turnBacks: 0,
    crossing: false,
  };
  s.men.push(m);
  return m;
}

export function addEnemy(s: GameState, kind: EnemyKind, x: number, y: number): Enemy {
  const e = createEnemy(s, kind, x, y);
  s.enemies.push(e);
  return e;
}
