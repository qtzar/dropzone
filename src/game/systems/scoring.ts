import type { GameState } from '../state';
import { emit } from '../events';
import { COMBO_WINDOW, MAX_MULTIPLIER, EXTRA_LIFE_EVERY } from '../constants';

export function addScore(s: GameState, points: number): void {
  s.score += points;
  while (s.score >= s.nextExtraLife) {
    s.lives++;
    s.nextExtraLife += EXTRA_LIFE_EVERY;
    emit(s, { type: 'extraLife' });
  }
}

export function registerKill(s: GameState, points: number, x: number, y: number): number {
  s.multiplier = s.comboTimer > 0 ? Math.min(MAX_MULTIPLIER, s.multiplier + 1) : 1;
  s.comboTimer = COMBO_WINDOW;
  const awarded = points * s.multiplier;
  addScore(s, awarded);
  emit(s, { type: 'scorePopup', x, y, points: awarded, multiplier: s.multiplier });
  return awarded;
}

export function awardBonus(s: GameState, points: number, x: number, y: number): number {
  const awarded = points * s.multiplier;
  addScore(s, awarded);
  emit(s, { type: 'scorePopup', x, y, points: awarded, multiplier: s.multiplier });
  return awarded;
}

export function tickCombo(s: GameState, dt: number): void {
  if (s.comboTimer <= 0) return;
  s.comboTimer -= dt;
  if (s.comboTimer <= 0) resetCombo(s);
}

export function resetCombo(s: GameState): void {
  s.multiplier = 1;
  s.comboTimer = 0;
}
