import type { EnemyKind } from './state';

export type ExplosionSource = EnemyKind | 'player' | 'man';

export type GameEvent =
  | { type: 'laserFired'; x: number; y: number; facing: 1 | -1 }
  | { type: 'enemyShot'; x: number; y: number }
  | { type: 'explosion'; x: number; y: number; source: ExplosionSource; big: boolean }
  | { type: 'scorePopup'; x: number; y: number; points: number; multiplier: number }
  | { type: 'manPickedUp'; x: number; y: number }
  | { type: 'manCaught'; x: number; y: number }
  | { type: 'manRescued'; x: number; y: number }
  | { type: 'manDied'; x: number; y: number }
  | { type: 'manSnatched'; x: number; y: number }
  | { type: 'playerDied'; x: number; y: number }
  | { type: 'playerRespawned'; x: number; y: number }
  | { type: 'bombDetonated'; x: number; y: number }
  | { type: 'cloakOn' }
  | { type: 'cloakOff' }
  | { type: 'waveStarted'; wave: number }
  | { type: 'waveCleared'; wave: number; bonus: number; saved: number }
  | { type: 'planetCritical' }
  | { type: 'hunterSpawned'; x: number; y: number }
  | { type: 'extraLife' }
  | { type: 'manWhistle'; x: number; y: number }
  | { type: 'manSelfRescued'; x: number; y: number }
  | { type: 'nemesiteWarning'; x: number; y: number }
  | { type: 'rumble'; x: number; y: number }
  | { type: 'protonBolt'; x: number; top: number; bottom: number }
  | { type: 'volcanoErupt'; x: number; y: number; whiteHot: boolean }
  | { type: 'planetUnstable' }
  | { type: 'invasionWave'; wave: number }
  | { type: 'nmeyeSpawned'; x: number; y: number }
  | { type: 'laserBlocked'; x: number; y: number }
  | { type: 'gameOver'; score: number };

export function emit(target: { events: GameEvent[] }, e: GameEvent): void {
  target.events.push(e);
}
