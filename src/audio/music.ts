import type { AudioEngine } from './engine';

const BPM = 112;
export const STEP_DUR = 60 / BPM / 4;
const LOOP_STEPS = 64;
const LOOKAHEAD = 0.12;
const SCHEDULE_MS = 25;

const semis = (base: number, n: number) => base * Math.pow(2, n / 12);

/** One chord per bar: bass root (Hz), arp base (Hz) and chord intervals (semitones). */
const BARS = [
  { bass: 110, arp: 220, chord: [0, 3, 7, 12] }, // Am
  { bass: 87.31, arp: 174.61, chord: [0, 4, 7, 12] }, // F
  { bass: 130.81, arp: 261.63, chord: [0, 4, 7, 12] }, // C
  { bass: 98, arp: 196, chord: [0, 4, 7, 12] }, // G
];

/** Lead melody: semitone offsets above the bar's arp base, one per 8th note (null = rest). */
const LEAD: Array<number | null> = [12, null, 15, 14, 12, null, 10, null];

export interface StepNotes {
  bass: number | null;
  arp: number | null;
  lead: number | null;
  kick: boolean;
  hat: boolean;
  snare: boolean;
}

export function musicStep(step: number, intensity: 0 | 1 | 2): StepNotes {
  const s = ((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
  const bar = BARS[Math.floor(s / 16)];
  const inBar = s % 16;
  const bass = inBar % 2 === 0 ? bar.bass * (inBar % 4 === 2 ? 2 : 1) : null;
  const arp = intensity >= 1 ? semis(bar.arp, bar.chord[inBar % bar.chord.length]) : null;
  let lead: number | null = null;
  if (intensity >= 2 && inBar % 2 === 0) {
    const n = LEAD[(inBar / 2) % LEAD.length];
    lead = n === null ? null : semis(bar.arp, n);
  }
  return {
    bass,
    arp,
    lead,
    kick: inBar % 4 === 0,
    hat: inBar % 2 === 1,
    snare: intensity >= 2 && (inBar === 4 || inBar === 12),
  };
}

export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private intensity: 0 | 1 | 2 = 0;

  constructor(private engine: AudioEngine) {}

  start(): void {
    const ctx = this.engine.ctx;
    if (!ctx || this.timer !== null) return;
    this.nextTime = ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), SCHEDULE_MS);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  setIntensity(level: 0 | 1 | 2): void {
    this.intensity = level;
  }

  private schedule(): void {
    const ctx = this.engine.ctx;
    if (!ctx || !this.engine.ready) return;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.02;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(musicStep(this.step, this.intensity), this.nextTime);
      this.nextTime += STEP_DUR;
      this.step = (this.step + 1) % LOOP_STEPS;
    }
  }

  private voice(type: OscillatorType, freq: number, t: number, dur: number, vol: number, cutoff: number): void {
    const { ctx, musicBus } = this.engine;
    if (!ctx || !musicBus) return;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(musicBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private drumNoise(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number): void {
    const { ctx, musicBus } = this.engine;
    const buf = this.engine.noiseBuffer();
    if (!ctx || !musicBus || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(musicBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private playStep(n: StepNotes, t: number): void {
    const { ctx, musicBus } = this.engine;
    if (!ctx || !musicBus) return;
    if (n.bass !== null) this.voice('sawtooth', n.bass, t, STEP_DUR * 1.8, 0.25, 600);
    if (n.arp !== null) this.voice('square', n.arp * 2, t, STEP_DUR * 0.9, 0.06, 2400);
    if (n.lead !== null) this.voice('sawtooth', n.lead * 2, t, STEP_DUR * 1.9, 0.07, 3200);
    if (n.kick) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.6, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(musicBus);
      o.start(t);
      o.stop(t + 0.2);
    }
    if (n.hat) this.drumNoise(t, 0.04, 0.08, 'highpass', 7000);
    if (n.snare) this.drumNoise(t, 0.15, 0.25, 'bandpass', 1800);
  }
}
