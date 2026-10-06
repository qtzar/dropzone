import type { GameEvent } from '../game/events';
import type { SfxPlayer } from './sfx';

export const LASER_THROTTLE = 0.05;
export const SHOT_THROTTLE = 0.08;

/** Returns a function that plays the right SFX for a batch of game events. `now` is in seconds. */
export function createEventAudio(sfx: SfxPlayer, now: () => number): (events: readonly GameEvent[]) => void {
  let lastLaser = -Infinity;
  let lastShot = -Infinity;
  return (events) => {
    for (const e of events) {
      switch (e.type) {
        case 'laserFired':
          if (now() - lastLaser >= LASER_THROTTLE) {
            sfx.laser();
            lastLaser = now();
          }
          break;
        case 'enemyShot':
          if (now() - lastShot >= SHOT_THROTTLE) {
            sfx.enemyShot();
            lastShot = now();
          }
          break;
        case 'explosion':
          if (e.source !== 'player') sfx.explosion(e.big);
          break;
        case 'manPickedUp':
          sfx.pickup();
          break;
        case 'manCaught':
          sfx.caught();
          break;
        case 'manRescued':
          sfx.rescue();
          break;
        case 'manDied':
          sfx.manLost();
          break;
        case 'bombDetonated':
          sfx.bomb();
          break;
        case 'playerDied':
          sfx.death();
          break;
        case 'extraLife':
          sfx.extraLife();
          break;
        case 'planetCritical':
          sfx.klaxon();
          break;
        case 'cloakOn':
          sfx.cloak(true);
          break;
        case 'cloakOff':
          sfx.cloak(false);
          break;
        case 'waveCleared':
          sfx.waveClear();
          break;
        case 'hunterSpawned':
          sfx.hunter();
          break;
        default:
          break;
      }
    }
  };
}
