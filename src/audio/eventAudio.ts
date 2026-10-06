import type { GameEvent } from '../game/events';
import type { SfxPlayer } from './sfx';

export const LASER_THROTTLE = 0.05;
export const SHOT_THROTTLE = 0.08;
export const ERUPTION_THROTTLE = 0.4;

/**
 * Returns a function that plays the right SFX for a batch of game events. `now` is in seconds.
 * `near(x)` says whether a world x is close enough to the camera to hear local sounds
 * (eruptions, storm rumbles and bolts); it defaults to hearing everything.
 */
export function createEventAudio(
  sfx: SfxPlayer,
  now: () => number,
  near: (x: number) => boolean = () => true,
): (events: readonly GameEvent[]) => void {
  let lastLaser = -Infinity;
  let lastShot = -Infinity;
  let lastEruption = -Infinity;
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
        case 'planetUnstable':
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
        case 'nmeyeSpawned':
          sfx.nmeyeWarning();
          break;
        case 'manWhistle':
          sfx.whistle();
          break;
        case 'manSelfRescued':
          sfx.selfRescue();
          break;
        case 'nemesiteWarning':
          sfx.nemesiteWarning();
          break;
        case 'rumble':
          if (near(e.x)) sfx.rumble();
          break;
        case 'protonBolt':
          if (near(e.x)) sfx.boltCrack();
          break;
        case 'volcanoErupt':
          if (near(e.x) && now() - lastEruption >= ERUPTION_THROTTLE) {
            sfx.eruption();
            lastEruption = now();
          }
          break;
        case 'invasionWave':
          sfx.invasion();
          break;
        default:
          break;
      }
    }
  };
}
