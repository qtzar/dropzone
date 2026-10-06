import { describe, it, expect } from 'vitest';
import { createEventAudio, LASER_THROTTLE } from '../../src/audio/eventAudio';
import type { SfxPlayer } from '../../src/audio/sfx';
import type { GameEvent } from '../../src/game/events';

function fakeSfx() {
  const calls: string[] = [];
  const rec = (name: string) => (arg?: unknown) => calls.push(arg === undefined ? name : `${name}:${String(arg)}`);
  const sfx: SfxPlayer = {
    laser: rec('laser'), enemyShot: rec('enemyShot'), explosion: rec('explosion'), pickup: rec('pickup'),
    caught: rec('caught'), rescue: rec('rescue'), manLost: rec('manLost'), bomb: rec('bomb'), death: rec('death'),
    extraLife: rec('extraLife'), klaxon: rec('klaxon'), cloak: rec('cloak'), waveClear: rec('waveClear'), hunter: rec('hunter'),
  };
  return { sfx, calls };
}

describe('createEventAudio', () => {
  it('maps game events to sound effects', () => {
    const { sfx, calls } = fakeSfx();
    const play = createEventAudio(sfx, () => 0);
    const events: GameEvent[] = [
      { type: 'explosion', x: 0, y: 0, source: 'orb', big: true },
      { type: 'manPickedUp', x: 0, y: 0 },
      { type: 'manCaught', x: 0, y: 0 },
      { type: 'manRescued', x: 0, y: 0 },
      { type: 'manDied', x: 0, y: 0 },
      { type: 'bombDetonated', x: 0, y: 0 },
      { type: 'playerDied', x: 0, y: 0 },
      { type: 'extraLife' },
      { type: 'planetUnstable' },
      { type: 'cloakOn' },
      { type: 'cloakOff' },
      { type: 'waveCleared', wave: 1, bonus: 0, saved: 0 },
      { type: 'hunterSpawned', x: 0, y: 0 },
    ];
    play(events);
    expect(calls).toEqual([
      'explosion:true', 'pickup', 'caught', 'rescue', 'manLost', 'bomb', 'death',
      'extraLife', 'klaxon', 'cloak:true', 'cloak:false', 'waveClear', 'hunter',
    ]);
  });

  it('does not play an explosion sound for the player (death covers it)', () => {
    const { sfx, calls } = fakeSfx();
    createEventAudio(sfx, () => 0)([{ type: 'explosion', x: 0, y: 0, source: 'player', big: true }]);
    expect(calls).toEqual([]);
  });

  it('throttles rapid laser sounds', () => {
    const { sfx, calls } = fakeSfx();
    let t = 0;
    const play = createEventAudio(sfx, () => t);
    const laser: GameEvent = { type: 'laserFired', x: 0, y: 0, facing: 1 };
    play([laser, laser]);
    t = LASER_THROTTLE / 2;
    play([laser]);
    t = LASER_THROTTLE * 1.5;
    play([laser]);
    expect(calls.filter((c) => c === 'laser')).toHaveLength(2);
  });
});

describe('createEventAudio nmeye', () => {
  it('plays the warning sting when an Nmeye appears', () => {
    const { sfx, calls } = fakeSfx();
    createEventAudio(sfx, () => 0)([{ type: 'nmeyeSpawned', x: 0, y: 0 }]);
    expect(calls).toEqual(['hunter']);
  });
});
