# Dropzone Remake — Design Spec

**Date:** 2026-10-05
**Status:** Approved (pending written-spec review)

## Goal

A browser-playable remake of the 1984 Atari 8-bit / C64 game *Dropzone*, with a neon/glow 2D visual style and modernised game feel, while keeping the original's core loop: fly a jetpack astronaut over a horizontally wrapping moonscape, destroy alien waves, and rescue stranded men by carrying them to the Dropzone base.

## Decisions

| Topic | Decision |
|---|---|
| Visual style | Neon / glow 2D vector art, all procedurally generated (no image assets) |
| Gameplay fidelity | Faithful core + modern feel (combo multiplier, hit-stop, tuned difficulty) |
| Platforms / input | Desktop browsers; keyboard + Gamepad API |
| Audio | Web Audio synthesized SFX + procedural synthwave music (no audio files) |
| Persistence | Local high scores + settings in `localStorage`; no backend |
| Stack | TypeScript + Vite + Canvas 2D, custom lightweight engine, Vitest. No runtime dependencies |

## 1. Architecture

### Layout

```
src/
  main.ts            boot: canvas setup, start game loop
  core/
    loop.ts          fixed-timestep loop (120 Hz sim, interpolated render)
    input.ts         keyboard + Gamepad → unified Actions
    rng.ts           seeded RNG (mulberry32)
    world.ts         wrapping-world math: wrapX, shortestDx, toScreen
  game/
    state.ts         GameState type (plain data)
    update.ts        update(state, actions, dt) orchestrator
    events.ts        GameEvent union + queue
    tuning.ts        wave/difficulty tuning tables (data)
    systems/         physics, collisions, ai, rescue, waves, scoring, powerups
    entities/        factory functions + per-type data
  render/
    renderer.ts      Renderer interface + Canvas2D implementation
    sprites.ts       procedurally generated, pre-rendered glow sprites
    effects.ts       particles, shake, flashes, starfield, terrain
    hud.ts           scanner, score, multiplier, lives, bombs, cloak meter
  audio/
    sfx.ts           synthesized effects
    music.ts         procedural music loop
  scenes/            title, playing, waveComplete, gameOver, highScoreEntry
  storage/scores.ts  high scores + settings persistence
```

### Principles

- **Game logic is headless.** `GameState` is plain data. `update()` mutates it given `Actions`, `dt`, and a seeded RNG. It never touches canvas, DOM, or audio.
- **Events decouple presentation.** Systems push `GameEvent`s (`explosion`, `manPickedUp`, `manRescued`, `manDied`, `playerHit`, `playerDied`, `bombDetonated`, `waveCleared`, `planetCritical`, `extraLife`, …) to a per-tick queue. Renderer and audio consume and clear it each frame.
- **One place for wrap math.** World width = 8 × 1280 = 10,240 world units. All horizontal distances/positions go through `world.ts`.
- **Fixed timestep.** Simulation at 120 Hz with an accumulator; render interpolates. Frame `dt` is clamped to 250 ms to avoid spiral-of-death after tab suspension.
- **Renderer behind an interface** so a future WebGL/Pixi backend replaces only `render/`.

## 2. Gameplay

The enemy roster is *inspired by* the original, not a verified recreation of it. Names and behaviours may differ from the 1984 game.

### Player
- Free flight with inertia: thrust acceleration, linear drag, light gravity, soft speed cap. Cannot go below terrain or above the scanner line.
- Faces left/right. Fires a fast horizontal laser: rapid fire, with an overheat meter that locks firing briefly when full.
- 3 lives. Extra life every 10,000 points.
- 3 smart bombs per game (+1 per 5 waves cleared, max 5). A bomb destroys all enemies and enemy shots currently on screen.
- Cloak: invulnerability while active. It drains a meter, which refills at each wave start.
- 2 s invulnerability after respawn (blinking).

### Men and the base
- 8 men per wave walk the terrain surface.
- Touching a man picks him up; he dangles below the player. Only one man is carried at a time.
- Delivering him to the **Dropzone base** (a fixed landing pad in the world) scores 500 × multiplier and removes him from play as "saved".
- A carried man can be killed by enemy shots or collisions.
- A falling man dies if he falls more than 200 units before landing. Catching him mid-air: +250, and he becomes carried.
- **Planet critical:** if all men are dead (none alive, carried, or falling), every surviving enemy converts to its aggressive variant, the sky tints red, and a klaxon sounds. This lasts until the end of the wave. The next wave keeps 0 men until the next 5-wave milestone, which restores 8.

### Enemies
| Enemy | Behaviour | Points |
|---|---|---|
| Snatcher | Descends toward a man, grabs him, ascends. On reaching the top it kills the man and becomes a Nemesite. Shooting it drops the man (falling). | 150 |
| Nemesite | Fast homing hunter, fires aimed shots. Also the aggressive variant everything turns into when the planet goes critical. | 200 |
| Trailer | Sinusoidal weaving path leaving a hazardous trail that lasts 1.5 s | 250 |
| Orb | Slow drifting mine. When shot it splits into 3 fragments (fast, 1 hit, 50 pts each) | 100 |
| Hunter | Spawns after 60 s on a wave (more after that). Very fast and relentless | 500 |

- Enemy shots are aimed at the player with slight lead. Fire rate scales with the wave.
- Collisions between the player and an enemy or enemy shot kill the player (unless cloaked or invulnerable).

### Waves
- A wave clears when there are no enemies left (Hunters included). Bonus = men saved this wave × 100 × wave number.
- Wave composition, speeds, and fire rates come from `tuning.ts`: an explicit table for waves 1–10, then formulaic scaling after that.

### Modern-feel additions
- **Combo multiplier:** each kill within 1.5 s of the previous one raises it (×1 → ×8). It resets on timeout or when the player is hit. It applies to kill and rescue points.
- **Hit-stop:** 3–5 sim-frame freeze on multi-kills and Hunter kills.
- **Scanner:** the top strip shows the whole world, with coloured blips for the player, men, enemies, and the base.

## 3. Rendering & Feel

- Internal resolution is 1280×720, scaled to fit with letterboxing. The backing store is sized by `devicePixelRatio`.
- Entities are vector line art, pre-rendered once into offscreen canvases with layered `shadowBlur` glow, then blitted with `drawImage`. There is no `shadowBlur` in the per-frame path.
- Additive blending (`lighter`) for lasers, particles, and explosions.
- Palette per type: player cyan, men green, Snatcher magenta, Nemesite red, Trailer orange, Orb violet, Hunter white-gold, base teal.
- Layers, back to front: space gradient + nebula → 3-depth parallax starfield → distant mountain silhouette → glowing wireframe terrain (seeded) → base, men, enemies, player, projectiles → particles → HUD.
- Juice: kill bursts (sparks + shockwave ring), thruster exhaust, muzzle flash, trauma-based screen shake, white flash on smart bomb, brief slow motion on player death, floating score popups. The camera leads in the facing direction with easing.
- Performance: pooled particles (cap 2,000) and off-screen culling. Target is 60 fps or better on integrated GPUs.

## 4. Audio, Scenes, Persistence, Errors

### Audio
- Synthesized SFX: laser, explosion, pickup, rescue chime, smart bomb, death, extra life, critical klaxon.
- Procedural synthwave loop (step sequencer: bass, arp, drums). Intensity rises with the wave and the critical state.
- The `AudioContext` is created or resumed on the first user gesture.
- Separate music/SFX volume and a mute toggle (`M`), all persisted.

### Scenes
`Title` (attract mode + high scores) → `Playing` → `WaveComplete` (bonus tally) → `Playing` … → `GameOver` → `HighScoreEntry` (3 initials) → `Title`.
Pause: `P` / `Esc` / gamepad Start. Auto-pause on `visibilitychange` / blur.

### Controls
| Action | Keyboard | Gamepad |
|---|---|---|
| Fly | Arrows / WASD | Left stick / D-pad |
| Fire | Space / J | A / RT |
| Smart bomb | B / K | B |
| Cloak | C / L | X |
| Pause | P / Esc | Start |
| Debug overlay | F3 | — |

Inputs from all devices are merged. Gamepads can be hot-plugged.

### Persistence
- Top 10 high scores + settings under a versioned `localStorage` key. Data is validated on load; corrupt or missing data falls back to the defaults. All access is wrapped in try/catch.

### Error handling
- If a gamepad or audio is unavailable, the game continues without it.
- `dt` is clamped.
- Top-level `error` / `unhandledrejection` handlers show an on-canvas overlay with the message.

## 5. Testing & Delivery

### Unit tests (Vitest)
- `world`: wrap, shortest distance across the seam, projection near the seam.
- Physics: thrust/drag/cap, gravity, terrain and ceiling bounds.
- Collisions: circle-vs-circle across the seam, laser hits.
- Rescue: pickup, carry, fall death threshold, mid-air catch, delivery, transition to critical.
- Waves: tuning-table scaling, wave-clear condition, Hunter timer.
- Scoring: combo timer and cap, extra-life thresholds, rescue bonus.
- Storage: insert/sort/truncate, corrupt-data recovery.
- Deterministic sim: seeded RNG + scripted inputs, run N seconds headless, then assert no NaNs, sane entity counts, and expected score.

### Manual verification
- Play in the browser via the dev server. Screenshots and console checks via browser automation at each milestone.
- F3 debug overlay: FPS, entity counts, hitboxes, seed.

### Delivery
- `npm run dev`; `npm run build` → static `dist/` deployable to any static host.

### Build order (each step playable)
1. Engine + flight + world wrap
2. Terrain + scanner + camera
3. Shooting + first enemy (Snatcher)
4. Men + base + rescue rules
5. Full enemy roster + waves + critical state
6. Juice / effects
7. Audio
8. Scenes, high scores, polish

## Out of scope (v1)
Mobile/touch controls, online leaderboards, upgrades/bosses, WebGL renderer, art or audio asset files.
