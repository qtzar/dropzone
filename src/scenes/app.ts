import { NO_ACTIONS, consumeEdges, type Actions } from '../core/input';
import { VIEW_W, clamp, lerpWrapped, shortestDx } from '../core/world';
import type { GameState } from '../game/state';
import { update } from '../game/update';
import { newGame } from '../game/systems/waves';
import type { Renderer } from '../render/renderer';
import { createCamera, updateCamera, type Camera } from '../render/camera';
import { Effects } from '../render/effects';
import { drawDebug } from '../render/debug';
import { AudioEngine, type AudioSettings } from '../audio/engine';
import { Sfx } from '../audio/sfx';
import { Music } from '../audio/music';
import { createEventAudio } from '../audio/eventAudio';
import {
  loadSave, writeSave, browserStore, insertScore, qualifies,
  type SaveData, type ScoreEntry, type KeyValueStore,
} from '../storage/scores';
import { demoActions } from './demo';
import { drawTitle, drawPaused, drawGameOver, drawInitials, INITIAL_CHARS } from './screens';

export type Scene = 'title' | 'playing' | 'paused' | 'gameOver' | 'enterInitials';

export interface InputSource {
  poll(): Actions;
}

export interface AppRenderer extends Renderer {
  readonly ctx: CanvasRenderingContext2D;
}

export const GAME_OVER_TIME = 3;
const VOLUME_STEP = 0.1;

function randomSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}

export class App {
  private _scene: Scene = 'title';
  private state: GameState;
  private camera: Camera;
  private fx = new Effects();
  private save: SaveData;
  private actions: Actions = NO_ACTIONS;
  private debug = false;
  private fps = 60;
  private initials = [0, 0, 0];
  private cursor = 0;
  private gameOverTimer = 0;
  private audio = new AudioEngine();
  private music = new Music(this.audio);
  private sfx = new Sfx(this.audio);
  private playEvents = createEventAudio(
    this.sfx,
    () => performance.now() / 1000,
    (x) => Math.abs(shortestDx(this.camera.x, x)) <= VIEW_W,
  );

  constructor(
    private renderer: AppRenderer,
    private input: InputSource,
    private store: KeyValueStore | null = browserStore(),
  ) {
    this.save = loadSave(store);
    this.audio.applySettings(this.save.settings);
    this.state = newGame(randomSeed());
    this.camera = createCamera(this.state.player.x);
  }

  get scene(): Scene {
    return this._scene;
  }

  get game(): GameState {
    return this.state;
  }

  get highScores(): readonly ScoreEntry[] {
    return this.save.scores;
  }

  get settings(): AudioSettings {
    return this.save.settings;
  }

  get debugEnabled(): boolean {
    return this.debug;
  }

  unlockAudio(): void {
    this.audio.unlock();
    this.music.start();
  }

  pause(): void {
    if (this._scene === 'playing') this.enterPause();
  }

  private enterPause(): void {
    this._scene = 'paused';
    this.audio.setPaused(true);
  }

  private leavePause(): void {
    this._scene = 'playing';
    this.audio.setPaused(false);
  }

  timeScale(): number {
    return this._scene === 'playing' ? this.fx.timeScale() : 1;
  }

  step(dt: number): void {
    let frozen = false;
    switch (this._scene) {
      case 'title':
        update(this.state, demoActions(this.state), dt);
        if (this.state.phase === 'gameOver') this.resetDemo();
        break;
      case 'playing':
        frozen = this.state.hitStop > 0;
        update(this.state, this.actions, dt);
        if (this.state.phase === 'gameOver') {
          this._scene = 'gameOver';
          this.gameOverTimer = GAME_OVER_TIME;
        }
        break;
      case 'gameOver':
        this.gameOverTimer -= dt;
        if (this.gameOverTimer <= 0) this.finishGameOver();
        break;
      case 'paused':
      case 'enterInitials':
        break;
    }
    // A bomb pressed during hit-stop stays pending until a real sim step sees it.
    const bomb = frozen && this.actions.bomb;
    this.actions = { ...consumeEdges(this.actions), bomb };
  }

  frame(alpha: number, frameDt: number): void {
    const polled = this.input.poll();
    // Keep an unconsumed bomb press pending until a sim step sees it.
    this.actions = { ...polled, bomb: polled.bomb || this.actions.bomb };
    const a = polled;
    this.fps += (1 / Math.max(frameDt, 1e-3) - this.fps) * 0.05;

    if (a.debug) this.debug = !this.debug;
    if (a.mute || a.musicDelta !== 0 || a.sfxDelta !== 0) this.adjustAudio(a);
    this.handleMenus(a);

    const s = this.state;
    if (this._scene === 'playing' || this._scene === 'gameOver') this.playEvents(s.events);
    this.fx.consume(s.events, s);
    s.events.length = 0;

    if (this._scene !== 'paused') {
      this.fx.update(frameDt, s);
      updateCamera(this.camera, lerpWrapped(s.player.prevX, s.player.x, alpha), s.player.facing, frameDt);
    }
    this.music.setIntensity(s.unstable ? 2 : s.wave >= 5 ? 1 : 0);
    this.sfx.setQuake(this._scene === 'playing' && s.unstable);
    this.renderer.render(s, this.camera, alpha, this.fx);
    this.drawScreens();
  }

  private handleMenus(a: Actions): void {
    switch (this._scene) {
      case 'title':
        if (a.confirm) this.startGame();
        break;
      case 'playing':
        if (a.pause) this.enterPause();
        break;
      case 'paused':
        if (a.pause || a.confirm) this.leavePause();
        break;
      case 'gameOver':
        if (a.confirm && this.gameOverTimer < GAME_OVER_TIME - 1) this.gameOverTimer = 0;
        break;
      case 'enterInitials':
        this.handleInitials(a);
        break;
    }
  }

  private handleInitials(a: Actions): void {
    const n = INITIAL_CHARS.length;
    if (a.menuY !== 0) this.initials[this.cursor] = (this.initials[this.cursor] - a.menuY + n) % n;
    if (a.menuX !== 0) this.cursor = clamp(this.cursor + a.menuX, 0, 2);
    if (a.confirm) {
      if (this.cursor < 2) this.cursor++;
      else this.submitInitials();
    }
  }

  private submitInitials(): void {
    const entry: ScoreEntry = {
      initials: this.initials.map((i) => INITIAL_CHARS[i]).join(''),
      score: this.state.score,
      wave: this.state.wave,
    };
    this.save = { ...this.save, scores: insertScore(this.save.scores, entry).scores };
    writeSave(this.store, this.save);
    this.toTitle();
  }

  private finishGameOver(): void {
    if (qualifies(this.save.scores, this.state.score)) {
      this._scene = 'enterInitials';
      this.initials = [0, 0, 0];
      this.cursor = 0;
    } else {
      this.toTitle();
    }
  }

  private adjustAudio(a: Actions): void {
    const st = { ...this.save.settings };
    if (a.mute) st.muted = !st.muted;
    st.musicVolume = Math.round(clamp(st.musicVolume + a.musicDelta * VOLUME_STEP, 0, 1) * 10) / 10;
    st.sfxVolume = Math.round(clamp(st.sfxVolume + a.sfxDelta * VOLUME_STEP, 0, 1) * 10) / 10;
    this.save = { ...this.save, settings: st };
    this.audio.applySettings(st);
    writeSave(this.store, this.save);
  }

  private startGame(): void {
    this.state = newGame(randomSeed());
    this.fx.reset();
    this.camera = createCamera(this.state.player.x);
    this._scene = 'playing';
    this.unlockAudio();
  }

  private toTitle(): void {
    this._scene = 'title';
    this.resetDemo();
  }

  private resetDemo(): void {
    this.state = newGame(randomSeed());
    this.fx.reset();
    this.camera = createCamera(this.state.player.x);
  }

  private drawScreens(): void {
    const ctx = this.renderer.ctx;
    const s = this.state;
    switch (this._scene) {
      case 'title':
        drawTitle(ctx, this.save.scores, s.time, this.save.settings);
        break;
      case 'paused':
        drawPaused(ctx);
        break;
      case 'gameOver':
        drawGameOver(ctx, s.score, s.wave);
        break;
      case 'enterInitials':
        drawInitials(ctx, this.initials.map((i) => INITIAL_CHARS[i]), this.cursor, s.score, performance.now() / 1000);
        break;
      case 'playing':
        break;
    }
    if (this.debug) drawDebug(ctx, s, this.camera.x, this.fps, this.fx.activeParticleCount());
  }
}
