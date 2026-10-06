import { describe, it, expect } from 'vitest';
import { createEventAudio, LASER_THROTTLE, ERUPTION_THROTTLE } from '../../src/audio/eventAudio';
import type { SfxPlayer } from '../../src/audio/sfx';
import type { GameEvent } from '../../src/game/events';

function fakeSfx() {
  const calls: string[] = [];
  const rec = (name: string) => (arg?: unknown) => calls.push(arg === undefined ? name : `${name}:${String(arg)}`);
  const sfx: SfxPlayer = {
    laser: rec('laser'), enemyShot: rec('enemyShot'), explosion: rec('explosion'), pickup: rec('pickup'),
    caught: rec('caught'), rescue: rec('rescue'), manLost: rec('manLost'), bomb: rec('bomb'), death: rec('death'),
    extraLife: rec('extraLife'), klaxon: rec('klaxon'), cloak: rec('cloak'), waveClear: rec('waveClear'),
    nmeyeWarning: rec('nmeyeWarning'), whistle: rec('whistle'), nemesiteWarning: rec('nemesiteWarning'),
    rumble: rec('rumble'), boltCrack: rec('boltCrack'), eruption: rec('eruption'), invasion: rec('invasion'),
    selfRescue: rec('selfRescue'),
  };
  return { sfx, calls };
}

describe('createEventAudio', () => {
  it('maps game events to sound effects', () => {
    const { sfx, calls } = fakeSfx();
    const play = createEventAudio(sfx, () => 0);
    const events: GameEvent[] = [
      { type: 'explosion', x: 0, y: 0, source: 'spore', big: true },
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
    ];
    play(events);
    expect(calls).toEqual([
      'explosion:true', 'pickup', 'caught', 'rescue', 'manLost', 'bomb', 'death',
      'extraLife', 'klaxon', 'cloak:true', 'cloak:false', 'waveClear',
    ]);
  });

  it('maps the phase 2 events to their new sounds', () => {
    const { sfx, calls } = fakeSfx();
    createEventAudio(sfx, () => 0)([
      { type: 'nmeyeSpawned', x: 0, y: 0 },
      { type: 'manWhistle', x: 0, y: 0 },
      { type: 'manSelfRescued', x: 0, y: 0 },
      { type: 'nemesiteWarning', x: 0, y: 0 },
      { type: 'rumble', x: 0, y: 0 },
      { type: 'protonBolt', x: 0, top: 100, bottom: 600 },
      { type: 'volcanoErupt', x: 0, y: 500, whiteHot: false },
      { type: 'invasionWave', wave: 5 },
    ]);
    expect(calls).toEqual([
      'nmeyeWarning', 'whistle', 'selfRescue', 'nemesiteWarning', 'rumble', 'boltCrack', 'eruption', 'invasion',
    ]);
  });

  it('only plays eruptions, rumbles and bolts that are near the camera', () => {
    const { sfx, calls } = fakeSfx();
    const play = createEventAudio(sfx, () => 0, (x) => x < 1000);
    play([
      { type: 'rumble', x: 5000, y: 0 },
      { type: 'protonBolt', x: 5000, top: 100, bottom: 600 },
      { type: 'volcanoErupt', x: 5000, y: 500, whiteHot: true },
      { type: 'rumble', x: 500, y: 0 },
    ]);
    expect(calls).toEqual(['rumble']);
  });

  it('throttles eruption sounds', () => {
    const { sfx, calls } = fakeSfx();
    let t = 0;
    const play = createEventAudio(sfx, () => t);
    const erupt: GameEvent = { type: 'volcanoErupt', x: 0, y: 500, whiteHot: false };
    play([erupt, erupt]);
    t = ERUPTION_THROTTLE * 1.5;
    play([erupt]);
    expect(calls.filter((c) => c === 'eruption')).toHaveLength(2);
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
