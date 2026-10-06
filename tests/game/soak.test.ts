import { describe, it, expect } from 'vitest';
import { update } from '../../src/game/update';
import { newGame } from '../../src/game/systems/waves';
import { SIM_DT } from '../../src/game/constants';
import { bot, type BotStats } from './support/bot';

/** Sim-time budget in seconds: ~2x the slowest observed seed (1037 s for seed 1; 955 and 1016 for 2 and 3). */
const TIME_LIMIT = 2100;
const TARGET_WAVE = 7;

function soak(seed: number) {
  const s = newGame(seed);
  s.lives = 999;
  const st: BotStats = { cloaks: 0, bombs: 0 };
  const maxTicks = Math.ceil(TIME_LIMIT / SIM_DT);
  let i = 0;
  for (; i < maxTicks && s.wave < TARGET_WAVE; i++) {
    update(s, bot(s, i, st, { useCloak: true, useBomb: true }), SIM_DT);
    s.events.length = 0;
  }
  return { wave: s.wave, time: s.time };
}

describe('scripted pilot soak', () => {
  it.each([1, 2, 3])('seed %i clears waves 1-6 (invasion wave 5, shipment wave 6)', (seed) => {
    const r = soak(seed);
    expect(r.wave).toBeGreaterThanOrEqual(TARGET_WAVE);
  });
});
