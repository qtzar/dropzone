# Dropzone

A browser remake of the 1984 Atari 8-bit and Commodore 64 classic **Dropzone**, with neon vector graphics and synthesized sound. It runs in any modern desktop browser, with keyboard or gamepad.

**▶ Play it now: https://qtzar.github.io/dropzone/**

> **An unofficial fan tribute.** This project is not affiliated with, endorsed by, or connected to Archer MacLean, Arena Graphics, U.S. Gold, or any rights holder. It contains no original code, graphics, or sound. Everything is recreated from scratch, out of affection for the original.

## A short history

*Dropzone* was written by **Archer MacLean** and released in **1984** by **U.S. Gold** (developed under the Arena Graphics name), first for the Atari 8-bit computers and then for the Commodore 64. It took the horizontally scrolling rescue-shooter formula of Williams' arcade hit *Defender* and gave it a story and character of its own. MacLean went on to make *International Karate +* and *Jimmy White's 'Whirlwind' Snooker*.

The game is set on **Io**, Jupiter's volcanic moon, where scientists mine ionic crystals that power starship travel. You wear an impulse-laser jetpack, and your job is to fly across a wrapping moonscape of volcanoes, lava ditches and an ionic lake, fighting off waves of aliens and carrying the scientists to safety at the moon base. The game was known for its speed, its scanner, and a memorable roster of enemies: Planters, Androids, Nemesites, Spores, Trailers, Blunderstorms, Nmeyes, and the Antimatter that appears if every scientist is lost.

For a detailed write-up of the original, see the [C64-Wiki article on Dropzone](https://www.c64-wiki.com/wiki/Dropzone).

## How to play

**Goal:** destroy every alien in each wave and get the scientists home. Scientists walk slowly toward the base on their own, but you score by flying down, picking them up, and landing them on the glowing **DROPZONE** pad. If every scientist dies, the planet goes unstable: an earthquake hits, the volcanoes spit white-hot rock, and the remaining aliens fuse into homing Antimatter.

### Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Fly | Arrow keys / WASD | Left stick / D-pad |
| Fire laser | Space / J | A / Right trigger |
| Smart bomb | B / K | B |
| Shield (hold) | C / L | X |
| Pause | P / Esc | Start |
| Start / confirm | Enter / Space | A / Start |
| Music volume | `[` `]` | |
| Effects volume | `-` `=` | |
| Mute | M | |
| Debug overlay | F3 | |

### The HUD

- **Scanner** (top centre): the whole wrapping world at a glance. The white cross is the base.
- **Scientist tracker** (beside the score): one icon per scientist. **Blue** means on the planet, **yellow** in danger (chased or falling), **green** safe, **red** lost.
- **Lives** (cyan ships) and **smart bombs** (gold circles), top right.
- **SHIELD**: seconds of invulnerability left. You gain 7 more every wave.
- **HEAT**: your laser overheats if you hold the trigger too long.

### Tips

- **Planters** hover over scientists and lower an **Android** to chase them. Shoot the Planter while it's lowering and the Android falls, which is worth 500.
- **Nemesites** dodge your laser until they're close. Let them come to you.
- **Spores** burst into four **Trailers** when shot. Trailers only die from a hit to the head.
- **Blunderstorms** drop acid and fire proton bolts. Watch for the rumble.
- Don't dawdle. Take too long and an **Nmeye** shows up. It's faster than you and drops bombs.
- Smart bombs clear everything on screen **except Androids**. You earn an extra life and a bomb every 10,000 points.
- Every fifth wave is a **Trailer invasion**. A fresh shipment of scientists arrives in the wave after.

## Running it locally

You need a recent [Node.js](https://nodejs.org/) (22 or newer recommended).

```bash
npm install
npm run dev       # start the dev server, then open the printed URL
npm test          # run the test suite
npm run build     # production build into dist/ (static files, host anywhere)
```

Every push to `main` is tested, built and deployed to GitHub Pages by `.github/workflows/deploy.yml`.

Built with TypeScript, Vite, Vitest, Canvas 2D and the Web Audio API. There are no runtime dependencies.
