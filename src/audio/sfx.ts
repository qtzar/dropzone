import type { AudioEngine } from './engine';

export interface SfxPlayer {
  laser(): void;
  enemyShot(): void;
  explosion(big: boolean): void;
  pickup(): void;
  caught(): void;
  rescue(): void;
  manLost(): void;
  bomb(): void;
  death(): void;
  extraLife(): void;
  klaxon(): void;
  cloak(on: boolean): void;
  waveClear(): void;
  nmeyeWarning(): void;
  whistle(): void;
  nemesiteWarning(): void;
  rumble(): void;
  boltCrack(): void;
  eruption(): void;
  invasion(): void;
  selfRescue(): void;
}

export class Sfx implements SfxPlayer {
  private quake: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  constructor(private engine: AudioEngine) {}

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const { ctx, sfxBus } = this.engine;
    if (!ctx || !sfxBus || !this.engine.ready) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, delay = 0): void {
    const { ctx, sfxBus } = this.engine;
    const buf = this.engine.noiseBuffer();
    if (!ctx || !sfxBus || !buf || !this.engine.ready) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private arpeggio(freqs: number[], type: OscillatorType, step: number, vol: number, delay = 0): void {
    freqs.forEach((f, i) => this.tone(type, f, f, step * 1.5, vol, delay + i * step));
  }

  laser(): void {
    this.tone('square', 1400, 300, 0.08, 0.06);
  }

  enemyShot(): void {
    this.tone('sawtooth', 600, 200, 0.12, 0.03);
  }

  explosion(big: boolean): void {
    this.noise(big ? 0.9 : 0.4, big ? 0.6 : 0.35, 2000, 100);
    this.tone('sine', 120, 40, big ? 0.6 : 0.3, 0.3);
  }

  pickup(): void {
    this.tone('triangle', 600, 900, 0.1, 0.15);
  }

  caught(): void {
    this.arpeggio([660, 880, 1100], 'triangle', 0.07, 0.15);
  }

  rescue(): void {
    this.arpeggio([523, 659, 784, 1047], 'triangle', 0.09, 0.2);
  }

  manLost(): void {
    this.tone('sawtooth', 400, 80, 0.5, 0.12);
  }

  bomb(): void {
    this.noise(1.5, 0.8, 4000, 60);
    this.tone('sine', 80, 25, 1.2, 0.5);
    this.tone('sawtooth', 200, 2000, 0.4, 0.08);
  }

  death(): void {
    this.noise(1.2, 0.6, 1500, 80);
    this.tone('square', 440, 40, 1.0, 0.12);
  }

  extraLife(): void {
    this.arpeggio([784, 988, 1175, 1568], 'square', 0.08, 0.08);
  }

  klaxon(): void {
    for (let i = 0; i < 4; i++) {
      this.tone('square', 520, 520, 0.24, 0.08, i * 0.5);
      this.tone('square', 390, 390, 0.24, 0.08, i * 0.5 + 0.25);
    }
  }

  cloak(on: boolean): void {
    this.tone('sine', on ? 300 : 900, on ? 900 : 300, 0.2, 0.1);
  }

  waveClear(): void {
    this.arpeggio([392, 523, 659, 784, 1047], 'triangle', 0.1, 0.18);
  }

  nmeyeWarning(): void {
    this.tone('sawtooth', 200, 800, 0.4, 0.07);
    this.tone('sawtooth', 200, 800, 0.4, 0.07, 0.45);
  }

  /** A man whistling for help: a rising then falling two-note whistle. */
  whistle(): void {
    this.tone('sine', 1800, 2500, 0.12, 0.08);
    this.tone('sine', 2500, 1600, 0.18, 0.08, 0.15);
  }

  nemesiteWarning(): void {
    this.tone('square', 880, 880, 0.07, 0.05);
    this.tone('square', 880, 880, 0.07, 0.05, 0.12);
  }

  rumble(): void {
    this.noise(0.8, 0.3, 320, 60);
  }

  boltCrack(): void {
    this.noise(0.25, 0.6, 6000, 800);
    this.tone('sawtooth', 1200, 100, 0.2, 0.08);
  }

  eruption(): void {
    this.noise(0.5, 0.25, 900, 120);
    this.tone('sine', 90, 40, 0.4, 0.15);
  }

  invasion(): void {
    this.arpeggio([392, 494, 587, 784], 'sawtooth', 0.12, 0.08);
    this.arpeggio([523, 659, 784, 1047], 'sawtooth', 0.12, 0.08, 0.5);
  }

  selfRescue(): void {
    this.arpeggio([1047, 1319, 1568], 'sine', 0.06, 0.12);
  }

  /** Starts or stops the low earthquake rumble loop. Safe to call every frame. */
  setQuake(on: boolean): void {
    const { ctx, sfxBus } = this.engine;
    if (on === (this.quake !== null)) return;
    if (!on) {
      const q = this.quake;
      this.quake = null;
      if (!q || !ctx) return;
      try {
        q.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
        q.src.stop(ctx.currentTime + 1);
      } catch {
        /* already stopped */
      }
      return;
    }
    const buf = this.engine.noiseBuffer();
    if (!ctx || !sfxBus || !buf || !this.engine.ready) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.5);
    src.connect(filter).connect(gain).connect(sfxBus);
    src.start();
    this.quake = { src, gain };
  }
}
