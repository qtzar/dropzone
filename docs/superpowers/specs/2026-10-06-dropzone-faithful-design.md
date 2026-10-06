# Dropzone Phase 2 — Faithful-to-the-Original Design

**Date:** 2026-10-06
**Status:** Approved in conversation (pending written-spec review)
**Builds on:** `2026-10-05-dropzone-design.md` (Phase 1, merged to `main`)
**Source:** https://www.c64-wiki.com/wiki/Dropzone. Items marked *(interp.)* are our interpretation where the wiki is vague.

## Goal

Make the remake follow the original 1984 game as closely as possible: the original enemy roster, the Io landscape, the men's behaviour, the wave structure, scoring, bombs and shield. Keep Phase 1's engine, neon visuals, controls, and modern extras (combo multiplier, hit-stop, popups, particles, slow-mo, screen shake).

## Decisions

| Topic | Decision |
|---|---|
| Approach | Evolve Phase 1 systems in place, with no new behaviour framework |
| Modern extras | Keep all of them. The combo multiplier applies on top of the original kill values |
| Men reaching the base unaided | Rescued with no points. Carrying them earns the rescue bonus |
| Controls | Unchanged from Phase 1 (keyboard + gamepad). The original's "any key cloaks" is not adopted |
| Credit | Title credit becomes `BASED ON DROPZONE (1984) BY ARCHER MACLEAN - ARENA GRAPHICS / U.S. GOLD`, plus `AN UNOFFICIAL FAN TRIBUTE` |
| Branch | `feature/dropzone-faithful` from `main` |

## 1. Enemy roster

These replace Snatcher, Orb/fragment and Hunter, which are removed along with their tests. `EnemyKind = 'planter' | 'android' | 'nemesite' | 'spore' | 'trailer' | 'blunderstorm' | 'nmeye' | 'antimatter'`.

| Kind | Behaviour | Points |
|---|---|---|
| Planter | Drifts horizontally at its cruise height (220–380). Over a volcano or the base it rises 120 above its cruise height. When a walking man is within 40 px horizontally and no other Android is chasing him, it hovers and lowers an Android on a tether (tether grows 120 px/s until the Android reaches the ground). When its Android dies, lands, or is released, the Planter converts to a Nemesite. | 250 |
| Android | While lowering, it hangs below its Planter (`linkedId`). On landing it chases its target man along the surface at 1.6× man walking speed. On contact the man dies *(interp.)*, and the Android then wanders on the surface. If its Planter is killed while it is lowering, it falls under gravity: a "falling" Android is worth 500, and it dies on hitting the ground. | 50 (lowering/chasing/walking), 500 (falling) |
| Nemesite | Homing missile, speed 260, turn rate 2/s. Dodge *(interp.)*: if a player laser is in flight on the same side, heading toward it, within 40 px vertically and more than 250 px away, it jinks vertically (±140 px/s for 0.35 s, `dodgeTimer`). Within 250 px it no longer dodges. A `nemesiteWarning` event fires when one first comes within 640 px of the player. | 150 |
| Spore | Drifts slowly (speed 50) and bounces between ceiling and ground. It never attacks ("harmless until triggered"), but touching it still kills the player like any enemy. When killed (laser or bomb), it releases 4 Trailers at 90° intervals. | 750 |
| Trailer | Weaving flight (current Phase 1 weave, without the hazard trail). On spawn, 50% are homers *(interp.)* (turn rate 1.5/s toward the player). Head-hit rule *(interp.)*: a laser kills it only if it hits the front half (the half facing its velocity direction). A hit on the tail half is absorbed: the laser dies and the Trailer survives. | 250 |
| Blunderstorm | Hovers in the upper band (y between CEILING_Y+20 and CEILING_Y+80), drifting slowly. Every 3–5 s *(interp.)* it either drops 5 acid drops (falling hazards, 220 px/s, lethal to the player, harmless to men), or emits a `rumble` event and 0.8 s later a proton bolt: a vertical lethal column 12 px wide from the storm to the ground, lasting 0.25 s. | 250 |
| Nmeye | Anti-camping: appears 60 s into a wave, then every 20 s. Speed 760, faster than the player's 720 max. It moves irregularly, picking a new heading every 0.4–0.9 s that is biased toward the player. It flashes (a render cue) and drops a bomb every 0.6 s (falls at 180 px/s, lethal to the player). | 100 |
| Antimatter | Created only when the planet goes unstable: each living Planter and Android is replaced by one Antimatter at its position. It circles (radius 80, angular speed 3 rad/s) around a centre that drifts toward the player at 160 px/s. | 150 |

Enemy shots: Planter and Nemesite fire aimed shots (Phase 1 mechanism). Fire multipliers: Planter 2, Nemesite 0.6, Nmeye 0 (it bombs instead), Trailer 1.5, all others 0.

## 2. Io landscape (`src/game/landscape.ts`)

Generated from the seed with the terrain, and stored in `GameState.landscape`.

- **Volcanoes:** 5, at least 1200 apart and none within 600 of the base. Each is a cone raised 90 px above the local terrain, 260 px wide, with the crater at its peak. Normal mode: every 2.5–4 s it lobs 1–2 magma balls (vx ±60–160, vy −380 to −260, gravity 300, radius 5). They are lethal to the player, harmless to men, and despawn on hitting the ground.
- **Ionic lake:** one stretch 360 px wide, at least 1500 from the base, flattened to a single height. It is drawn as a glowing liquid surface. Men turn around at its edges.
- **Lava ditches:** 3 dips, each 64 px wide and 30 px deep, drawn with a lava glow. A falling man who lands in a ditch dies regardless of fall height. A walking man turns back at a ditch's edge.
- **Craters:** 4 decorative bowls in the terrain profile.
- Queries: `volcanoAt(x)`, `isLake(x)`, `isLava(x)`. Terrain heights include the volcano cones, lake flattening and ditch dips, so `groundYAt` stays the single source of ground height.
- **Base:** unchanged raised pad. On the scanner it is drawn as a white cross.

## 3. Men

- They walk toward the base by the shortest wrapped direction at the existing walk speed. They stop and reverse for 1–2 s at the lake or a lava ditch edge, then resume.
- A walking man who reaches the base pad (`|shortestDx| ≤ BASE_WIDTH/2`) is rescued: state `saved`, counted as a survivor, 0 points, and a `manSelfRescued` event fires.
- Carried delivery: 100 × wave points, capped at 500, times the combo multiplier. It counts as a survivor.
- When an Android targets a man, he whistles: a `manWhistle` event, and a "!" is drawn above him while he is chased.
- Pickup, carry, fall and catch work as in Phase 1. A fall kills him if it exceeds `MAN_SAFE_FALL`, or if he lands in a lava ditch.

## 4. Planet unstable (all men lost)

Triggered when the wave had men and all of them are `dead`.
- All living Planters and Androids are replaced by Antimatter.
- An earthquake follows: a continuous screen shake (trauma ≥ 0.35), a low rumble, and a `planetUnstable` event, which replaces `planetCritical`.
- Volcanoes switch to white-hot rocks: every 1–1.8 s, 2–3 rocks, radius 8, faster (vy −480 to −340).
- The red sky tint stays. All of this lasts until the wave ends.

## 5. Waves

- Wave numbers run 1–99. After 99, the next wave number cycles 95→99 repeatedly (wave 100 plays as 95, and so on). The displayed number keeps counting.
- A wave ends when no living enemies remain AND no man is `walking`, `carried`, `snatched` or `falling`. The `snatched` state is replaced by `chased` (an Android has targeted him) and is still "unresolved".
- Survivors: men saved during wave N are re-deployed at the start of wave N+1. Dead men are gone.
- Invasion waves: every wave where `wave % 5 === 0` is a Trailer invasion. Enemies are 6 + wave/5 Trailers plus 2 Spores, there are no men (survivors wait), and a "TRAILER INVASION" banner shows with an `invasionWave` event.
- Shipments: every wave where `wave % 5 === 1` and `wave > 1` resets the men to 8 (survivors are topped up to 8).
- After a wave where the planet went unstable, the following waves have 0 men until the next shipment.
- The Nmeye timer is 60 s, then every 20 s (replacing the Hunter timer).
- Composition (`tuning.ts`): an explicit table for waves 1–10 of Planters, Spores and Blunderstorms, then a formula, with speed scale and fire interval as in Phase 1.
  - Waves 1–2 have no Blunderstorms. They appear from wave 3.
  - Invasion waves override the table.
- End-of-wave bonus: survivors saved this wave × wave, capped at 500 per man, times the multiplier. It is shown on the WAVE COMPLETE screen.

## 6. Scoring, lives, bombs, shield

- Kill points follow the roster table, times the combo multiplier (Phase 1 combo rules unchanged).
- Losing a life costs −10 points (score floors at 0).
- Every 10,000 points gives +1 life and +1 smart bomb (bombs capped at 9), up to 1,000,000 points, after which there are no more awards. This replaces "+1 bomb every 5 waves".
- Smart bomb (Strata Bomb): kills all living enemies on screen (Phase 1 led-screen centre) **except Androids**. Spores killed by it release Trailers, and those Trailers survive the blast. It clears enemy shots, acid, magma and bombs on screen.
- Shield (cloak): `shieldBank` in seconds. It starts at 7, gains 7 at each wave start, has no cap, and drains 1 per second while active. The HUD shows `SHIELD 12.4s` instead of the meter.

## 7. Rendering & audio

- **New glow sprites:** Planter (saucer with a tether line drawn to its Android), Android (small walker), Spore (pulsing pod), Trailer (bright head chevron with a dimmer tail), Blunderstorm (cloud outline), Nmeye (eye that flashes white), Antimatter (spinning knot).
- **Landscape rendering:** volcano cones with glowing craters, eruption particles, white-hot rock glow when unstable, a lake surface shimmer, lava ditch glow, and a white base cross on the scanner.
- **Effects:** earthquake trauma, "TRAILER INVASION" banner, a "!" over chased men, acid drops, proton bolt flash, Nmeye bombs.
- **New SFX:** whistle, Nemesite warning, Blunderstorm rumble and bolt crack, volcano eruption, earthquake rumble loop, Nmeye warning, invasion fanfare, self-rescue chime.
- **Title credit:** updated (see Decisions).

## 8. Architecture changes

- `state.ts`: new `EnemyKind`. Enemy fields `linkedId`, `tetherLen`, `dodgeTimer`, `homer` (Trailer), `falling` (Android: true once released from its Planter in mid-air), and `orbitAngle`/`orbitX`/`orbitY` for Antimatter. Remove `trails`. Add hazard lists `magma`, `acid`, `bolts`, `bombs`, plus `landscape`, `survivors`, `shieldBank` and `unstable` (renamed from `critical`). Man state `snatched` is replaced by `chased`.
- New files:
  - `src/game/landscape.ts`
  - `src/game/systems/volcanoes.ts`
  - `src/game/systems/hazards.ts` (moves magma, acid, bolts and bombs, plus their player collisions)
  - AI split into `src/game/systems/ai/{planter,homers,spawners,storm}.ts`, with `ai/index.ts` dispatching per kind and holding the shared fire logic.
- Updated: `enemies.ts`, `combat.ts` (head-hit rule, Android drop, Spore release, bomb exception), `rescue.ts`, `waves.ts`, `tuning.ts`, `scoring.ts`, `powerups.ts`, `update.ts`, renderer, HUD, effects, audio and screens.
- The determinism and constraint rules from Phase 1 still apply.

## 9. Testing

TDD per task, covering:
- Planter lowering, Android drop and 500-point falling kill, Planter→Nemesite conversion
- Android chase and kill
- Nemesite dodge then commit
- Spore releasing 4 Trailers, Trailer head and tail hits
- Blunderstorm acid and bolt timing
- Nmeye spawn timer and bombs, Antimatter conversion and orbit
- Volcano magma, and white-hot mode when unstable
- Landscape placement constraints and `groundYAt` including features
- Men walking to the base, turning at lake and lava, self-rescue, lava fall death
- Survivors carrying over, invasion waves, shipments, the 95–99 cycle
- The 500 cap, −10 per death, +bomb with +life up to 1,000,000
- Bombs sparing Androids, the shield bank

The deterministic simulation test must reach wave 6 in an automated run: clear enemies and resolve men each wave. A browser check follows each milestone.

## Out of scope
The original's exact pixel art, sound samples and wave layouts (we have no data on them), the "any key cloak" control, and the joystick-only control scheme.
