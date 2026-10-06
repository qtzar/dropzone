import { describe, it, expect } from 'vitest';
import { musicStep, STEP_DUR } from '../../src/audio/music';

describe('musicStep', () => {
  it('runs at 112 BPM in 16th notes', () => {
    expect(STEP_DUR).toBeCloseTo(60 / 112 / 4);
  });

  it('kicks on every beat', () => {
    for (let step = 0; step < 64; step++) {
      expect(musicStep(step, 0).kick).toBe(step % 4 === 0);
    }
  });

  it('plays bass on 8th notes following the Am-F-C-G roots', () => {
    expect(musicStep(0, 0).bass).toBeCloseTo(110);
    expect(musicStep(1, 0).bass).toBeNull();
    expect(musicStep(16, 0).bass).toBeCloseTo(87.31, 1);
    expect(musicStep(32, 0).bass).toBeCloseTo(130.81, 1);
    expect(musicStep(48, 0).bass).toBeCloseTo(98, 1);
  });

  it('adds the arpeggio at intensity 1 and snare + lead at intensity 2', () => {
    expect(musicStep(0, 0).arp).toBeNull();
    expect(musicStep(0, 1).arp).not.toBeNull();
    expect(musicStep(4, 1).snare).toBe(false);
    expect(musicStep(4, 2).snare).toBe(true);
    expect(musicStep(0, 1).lead).toBeNull();
    expect(musicStep(0, 2).lead).not.toBeNull();
  });

  it('wraps every 64 steps', () => {
    expect(musicStep(64, 2)).toEqual(musicStep(0, 2));
  });
});
