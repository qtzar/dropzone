import type { Actions } from '../core/input';
import type { GameState } from './state';
import { updatePlayerMovement, updatePlayerTimers } from './systems/player';
import { updateFiring, updateLasers } from './systems/weapons';
import { updateEnemies, updateShots } from './systems/ai';
import { updateMen, checkUnstable } from './systems/rescue';
import { resolveLaserHits, resolvePlayerHits, pruneDead } from './systems/combat';
import { tickCombo } from './systems/scoring';
import { updateWaveTimers, checkWaveClear, updateWavePhase } from './systems/waves';
import { updateCloak, triggerBomb, updateRespawn } from './systems/powerups';
import { updateHazards, resolveHazardHits } from './systems/hazards';
import { updateVolcanoes } from './systems/volcanoes';

/**
 * One fixed simulation tick. Order matters:
 * 1. player (timers, respawn, flight, shield)
 * 2. player weapons (bomb, firing, lasers)
 * 3. world movers (enemies + their shots, volcanoes, hazards, men)
 * 4. collisions (lasers -> enemies, enemies/shots -> player, hazards -> player)
 * 5. rules (planet unstable, combo decay, Nmeye timer), then cleanup and the wave-end check.
 */
export function update(s: GameState, a: Actions, dt: number): void {
  if (s.phase === 'gameOver') return;
  if (s.hitStop > 0) {
    s.hitStop = Math.max(0, s.hitStop - dt);
    s.player.prevX = s.player.x;
    s.player.prevY = s.player.y;
    return;
  }
  s.time += dt;

  updatePlayerTimers(s, dt);
  updateRespawn(s, dt);
  updatePlayerMovement(s, a, dt);
  updateCloak(s, a, dt);

  if (s.phase === 'waveComplete') {
    updateMen(s, dt);
    updateLasers(s, dt);
    updateHazards(s, dt);
    updateWavePhase(s, dt);
    return;
  }

  if (a.bomb) triggerBomb(s);
  updateFiring(s, a, dt);
  updateLasers(s, dt);
  updateEnemies(s, dt);
  updateShots(s, dt);
  updateVolcanoes(s, dt);
  updateHazards(s, dt);
  updateMen(s, dt);
  resolveLaserHits(s);
  resolvePlayerHits(s);
  resolveHazardHits(s);
  checkUnstable(s);
  tickCombo(s, dt);
  updateWaveTimers(s, dt);
  pruneDead(s);
  checkWaveClear(s);
}
