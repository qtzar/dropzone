# Neon Style Guide

How this remake gets its look, feel and sound. This guide is written so another project, for example a remake of a different classic, can reproduce the same style. Every section links to the source that implements it in this repo: `https://github.com/qtzar/dropzone/tree/main/src`.

## Principles

- **Vector line art, never bitmaps.** Every entity is a few stroked paths drawn in code. There are no image or audio asset files.
- **Light on black.** Dark backgrounds, saturated glowing lines, and additive blending for anything that emits light.
- **Glow is pre-rendered, never per frame.** `shadowBlur` is only used once, when sprites are baked into offscreen canvases. Per-frame glows are faked with a wide, faint stroke plus a thin, bright stroke.
- **One colour per role.** Each entity type has its own hue so the screen reads at a glance. Hazards are hot colours, friendly things are cyan or green.
- **Juice everywhere, but cosmetic only.** Particles, shake, flashes and slow-motion live in the render layer and never affect the deterministic game simulation.
- **Retro honesty.** Monospace type, a scanner strip, arcade high-score entry. The modern part is the rendering, not the layout.

## Canvas setup

*Source: `src/render/canvas.ts`, `src/core/world.ts`*

- Fixed internal resolution **1280 × 720** game units, letterboxed to fit the window, with a black surround.
- The backing store is sized by `devicePixelRatio`, so lines stay crisp on high-DPI screens.
- Each frame:
  1. Clear to black.
  2. Set one transform that maps game units to device pixels.
  3. Clip to the game area.
- The world wraps horizontally (8 screens wide). Every horizontal distance goes through `wrapX`/`shortestDx`.

## Palette

*Source: `src/render/palette.ts`*

| Role | Hex | Notes |
|---|---|---|
| Player | `#22e6ff` | Cyan. The hero colour, also used for lives icons |
| Player laser | `#9ff6ff` | Paler cyan, drawn additively |
| Rescuable people | `#4dff88` | Green = good / safe |
| Base / landing pad | `#19e3c3` | Teal |
| Terrain ridge | `#3d7bff` | Electric blue wireframe |
| Terrain (danger state) | `#ff3b5c` | The whole world shifts red when things go wrong |
| HUD labels | `#9ad8ff` | Soft blue |
| HUD values / text | `#e8f6ff` | Near-white |
| Warnings | `#ff4d6d` | Hot pink-red |
| Gold accents | `#ffe066` | Combo multiplier, bombs, score highlights |
| Enemy shots | `#ff6a6a` | |
| Magma / lava | `#ff7a1a` | White-hot variant `#fff3c4` |
| Enemies | `#ff4fd8` `#b8ff3a` `#ff3b3b` `#c56bff` `#ff9a1f` `#8fb8ff` `#ff5fa0` `#f0f0ff` | One per enemy type: magenta, lime, red, violet, orange, sky, pink, white |

Backgrounds:
- **Sky gradient:** top `#02010a` to bottom `#0a0630`. In the danger state: `#1a0005` to `#3a0010`.
- **Nebula:** a large radial gradient at `rgba(120,60,255,0.10)` fading to transparent. In the danger state: `rgba(255,40,80,0.12)`.

## Glow sprites

*Source: `src/render/sprites.ts`*

Each sprite is baked once into an offscreen canvas at **2× scale**, with padding for the glow. The same path-drawing function is stroked four times:

| Pass | `shadowBlur` (×2 for scale) | `lineWidth` | Colour |
|---|---|---|---|
| 1 Outer glow | 16 | 3 | role colour |
| 2 Inner glow | 6 | 2 | role colour |
| 3 Line | 0 | 1.5 | role colour |
| 4 Hot core | 0 | 0.75 | `rgba(255,255,255,0.6)` |

All four passes use `lineJoin` and `lineCap` set to `round`. The draw function strokes its own paths, centred on (0, 0) and facing right. At runtime sprites are blitted with `drawImage`, with an optional horizontal flip, alpha and rotation.

Sprite design language:
- Simple geometric silhouettes, 10–20 units in radius.
- Two or three shapes per sprite: a circle for a head or eye, a polygon for a body, a few lines for limbs and weapons.
- Readable at a glance, at the size of a few pixels.

## Additive light

*Source: `src/render/renderer.ts`, `src/render/effects.ts`*

Anything that emits light is drawn with `globalCompositeOperation = 'lighter'`: lasers, shots, particles, shockwave rings, magma, bolts. Reset to `'source-over'` afterwards. Overlapping lights then bloom naturally.

**Lasers** are drawn in two passes along a 70-unit trail behind the head:
1. `lineWidth` 7 at alpha 0.3.
2. `lineWidth` 2 at alpha 1.

## Background layers

*Source: `src/render/background.ts`*

Drawn back to front:

1. **Sky gradient and nebula** (above).
2. **Parallax starfield:** three layers.
   - Layer 1: 140 stars, size 1, scroll factor 0.125.
   - Layer 2: 80 stars, size 1.5, scroll factor 0.25.
   - Layer 3: 45 stars, size 2, scroll factor 0.375.
   - Random alpha from 0.3 to 1.
   - In a wrapping world, choose factors so that `WORLD_W × factor` is an exact multiple of the tile width. Otherwise the stars jump at the seam.
3. **Distant mountains:** a periodic silhouette, filled `#0b0a2a` with a faint stroke `rgba(90,90,200,0.35)`, at parallax factor 0.4.
4. **Terrain:**
   - Fill under the ridge: a gradient from `rgba(10,20,70,0.9)` to black.
   - Faint vertical wireframe lines every 4 samples, alpha 0.18.
   - The ridge line itself in two strokes: `lineWidth` 8 at alpha 0.2, then `lineWidth` 2 at alpha 1. This fakes a glow with no blur.
5. **Landmarks:** for example the landing pad.
   - The beam is a vertical gradient fading upward.
   - The pad outline uses the same wide-faint and thin-bright double stroke.
   - Beacons pulse with `0.5 + 0.5·sin(t·4)`.

## HUD

*Source: `src/render/hud.ts`, `src/render/debug.ts`*

- **Top strip:** 80 units tall, `rgba(0,0,0,0.55)`, with a 1 px divider line.
- **Scanner:**
  - Box at `{ x: 240, y: 8, w: 800, h: 64 }`, background `rgba(0,10,30,0.85)`, `#9ad8ff` border.
  - Inside: a mini terrain line, 3–6 px coloured blips per entity, and a white bracket for the current view.
- **Left panel:** label `SCORE` in 11px, the score in bold 22px monospace zero-padded to 8 digits, the multiplier in gold, and the wave number.
- **Right panel:** lives as small filled triangles, bombs as gold circles (filled = available), and thin meters with tiny labels.
- **Status trackers** (for example the scientist tracker): rows of tiny stick-figure icons coloured by state.
  - blue `#3d8bff` = active
  - yellow `#ffd23d` = in danger
  - green `#4dff88` = safe
  - red `#ff3b3b` = lost
- **Type:** monospace throughout. Wrap the HUD in `save()`/`restore()` so it never leaks canvas state.

## Glowing title text

*Source: `src/scenes/screens.ts`*

Draw a title three times:
1. `strokeText` with `lineWidth = size/5` at alpha 0.2.
2. `strokeText` with `lineWidth = size/10` at alpha 0.4.
3. `fillText` at alpha 1.

The title logo is 96px bold monospace in player cyan. Blinking prompts toggle with `floor(t·2) % 2`.

Screen overlays (title, pause, game over) dim the running game underneath with `rgba(0,0,10,0.5–0.7)`. Keep the game, or an AI demo of it, animating behind the title.

## Effects ("juice")

*Source: `src/render/effects.ts`, `src/render/camera.ts`*

- **Particle pool:** 2000 pre-allocated particles in a ring buffer, so nothing is allocated per frame. Particles have drag, light gravity (120), fade by remaining life, and are culled off-screen.
- **Explosions:**
  - Coloured sparks: 28, or 70 for big explosions, at speeds of 260–420 units/s.
  - Plus 10 white sparks.
  - Plus an expanding shockwave ring (60–200 radius, 0.4–0.6 s).
- **Thruster:** 2 orange particles per frame (`#ffb347` and `#ff5e3a`) behind the jetpack.
- **Score popups:** text that drifts upward and fades over 1 s, in gold when a multiplier applied.
- **Screen shake:** trauma-based.
  - Trauma is a value from 0 to 1. Events add to it and it decays at 1.2 per second.
  - The offset is `16 · trauma² · sin(t · 91.3)` horizontally and the same with `sin(t · 73.7 + 1.3)` vertically.
- **Flash:** a full-screen fill that decays at 2.5 per second. White for bombs, warning red for disasters. Only flash for events that happen on screen.
- **Slow motion:** on player death, run the simulation at 0.35× for 0.8 real seconds. Drive it through the game loop's time-scale hook.
- **Hit-stop:** freeze the simulation for 0.03–0.04 s on multi-kills and big kills.
- **Camera:** leads ahead of the facing direction by 18% of the screen width, and eases toward its target at rate 8 per second.

## Sound

*Source: `src/audio/engine.ts`, `src/audio/sfx.ts`, `src/audio/music.ts`, `src/audio/eventAudio.ts`*

- Everything is synthesized with the Web Audio API.
- **Audio graph:** master gain → separate SFX and music buses. Music sits at 0.6× headroom.
- **Unlocking:** create or resume the AudioContext on the first key press or click. Suspend it while paused.
- **SFX recipes:** oscillator pitch sweeps through exponential gain envelopes, plus filtered white noise for explosions.
  - Laser: square wave, 1400 → 300 Hz over 0.08 s.
  - Explosion: lowpass noise 2000 → 100 Hz, plus a sine thump 120 → 40 Hz.
  - Pickups and rescues: rising triangle-wave arpeggios.
  - Warnings: alternating square-wave klaxons.
- **Throttling:** limit rapid-fire sounds (lasers about 20 per second), and only play local events when they are near the camera.
- **Music:** a step sequencer with lookahead scheduling (a 25 ms timer scheduling 120 ms ahead).
  - Synthwave at 112 BPM, in 16th notes, 64 steps long.
  - Chords Am – F – C – G.
  - Parts: sawtooth bass on 8th notes, square-wave arpeggio, sine kick on the beat, highpass-noise hats on the off-beat.
  - Intensity levels add parts: level 1 adds the arpeggio, level 2 adds snare and lead.

## Do and don't

- **Do** keep the game logic headless and deterministic. Effects and audio react to events the simulation emits.
- **Do** give every new entity a distinct palette hue, a glow sprite and an explosion colour.
- **Don't** use `shadowBlur` in per-frame code. It's slow. Bake it into sprites, or use the double-stroke trick.
- **Don't** use bitmap fonts, images or sampled audio. The whole aesthetic is code-drawn.
- **Don't** let screen-filling effects (flashes) fire for off-screen events.

## Using this guide in another project

Add a line like this to the new project's `CLAUDE.md`:

```
Visual and audio style: follow https://github.com/qtzar/dropzone/blob/main/docs/neon-style.md
and the source files it references in the qtzar/dropzone repo.
```
