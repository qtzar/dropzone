import { SCANNER_H } from '../core/world';

export const SIM_HZ = 120;
export const SIM_DT = 1 / SIM_HZ;

/** Highest y (smallest value) any flying entity may reach. */
export const CEILING_Y = SCANNER_H + 16;

// Player flight
export const PLAYER_RADIUS = 14;
export const PLAYER_THRUST = 2600;
export const PLAYER_DRAG = 3;
export const PLAYER_GRAVITY = 160;
export const PLAYER_MAX_VX = 720;
export const PLAYER_MAX_VY = 460;

// Player laser
export const LASER_SPEED = 2200;
export const LASER_LIFE = 0.45;
export const FIRE_INTERVAL = 0.09;
export const HEAT_PER_SHOT = 0.07;
export const HEAT_COOL_RATE = 0.45;
/** After overheating, firing unlocks once heat falls below this. */
export const OVERHEAT_UNLOCK = 0.35;

// Lives, bombs, cloak
export const START_LIVES = 3;
/** Every 10,000 points gives +1 life and +1 smart bomb... */
export const EXTRA_LIFE_EVERY = 10000;
/** ...up to this score, after which there are no more awards. */
export const EXTRA_AWARD_LIMIT = 1_000_000;
/** Points lost per death (the score never goes below 0). */
export const DEATH_PENALTY = 10;
export const START_BOMBS = 3;
export const MAX_BOMBS = 9;
/** Shield (cloak) seconds at the start of a game. */
export const SHIELD_START = 7;
/** Shield seconds added at the start of every wave after the first (no cap). */
export const SHIELD_PER_WAVE = 7;
/** Shield seconds drained per second while the shield is on. */
export const SHIELD_DRAIN = 1;
export const RESPAWN_DELAY = 2;
export const RESPAWN_INVULN = 2;

// Men and base
export const MEN_PER_WAVE = 8;
export const MAN_RADIUS = 8;
export const MAN_WALK_SPEED = 18;
export const MAN_FALL_GRAVITY = 300;
export const MAN_SAFE_FALL = 200;
/** A man who reaches the lake or a lava ditch walks back for this long (s) before heading for the base again. */
export const MAN_TURN_MIN = 1;
export const MAN_TURN_MAX = 2;
/** Turn-backs at an obstacle edge before a man crosses it anyway. */
export const MAN_CROSS_AFTER = 2;
/** Horizontal speed while hopping over a lava ditch. */
export const MAN_HOP_SPEED = 90;
/** Height a hopping man is lifted above a lava ditch. */
export const MAN_HOP_HEIGHT = 16;
/** Wading speed through the ionic lake, as a fraction of walking speed. */
export const MAN_WADE_FACTOR = 0.6;
export const MAN_CARRY_OFFSET = 26;
/** Carried delivery scores 100 x wave, capped at 500. */
export const RESCUE_POINTS_PER_WAVE = 100;
export const RESCUE_POINTS_CAP = 500;
export const CATCH_POINTS = 250;
export const BASE_WIDTH = 160;
/** Player must be within this height above the pad surface to deliver a man. */
export const BASE_DELIVERY_HEIGHT = 70;
/** End-of-wave bonus per survivor saved this wave: 100 x wave, capped at 500. */
export const WAVE_BONUS_PER_MAN = 100;
export const WAVE_BONUS_CAP = 500;

// Scoring
export const COMBO_WINDOW = 1.5;
export const MAX_MULTIPLIER = 8;

// Enemies
export const ENEMY_SHOT_SPEED = 380;
export const ENEMY_SHOT_LIFE = 3;
/** The first Nmeye appears this many seconds into a wave, then one every NMEYE_REPEAT seconds. */
export const NMEYE_DELAY = 60;
export const NMEYE_REPEAT = 20;
/** Enemies only shoot when within this horizontal distance of the player. */
export const ENEMY_FIRE_RANGE = 800;

// Phase 2 enemy roster
export const PLANTER_CRUISE_MIN = 220;
export const PLANTER_CRUISE_MAX = 380;
export const STORM_BAND_TOP = CEILING_Y + 20;
export const STORM_BAND_BOTTOM = CEILING_Y + 80;
export const STORM_ACTION_MIN = 3;
export const STORM_ACTION_MAX = 5;
export const TRAILER_HOMER_CHANCE = 0.5;
export const NMEYE_BOMB_INTERVAL = 0.6;
export const ANTIMATTER_ORBIT_RADIUS = 80;
/** Planters rise this far above their cruise height over a volcano or the base. */
export const PLANTER_RISE = 120;
/** A Planter starts lowering when a walking man is within this horizontal distance. */
export const PLANTER_SPOT_RANGE = 40;
export const TETHER_SPEED = 120;
export const ANDROID_CHASE_MULT = 1.6;
export const ANDROID_FALL_GRAVITY = 300;
export const ANDROID_FALLING_POINTS = 500;
export const NEMESITE_TURN_RATE = 2;
/** A Nemesite only dodges lasers that are further away than this; closer, it commits. */
export const NEMESITE_COMMIT_RANGE = 250;
export const NEMESITE_DODGE_BAND = 40;
export const NEMESITE_DODGE_SPEED = 140;
export const NEMESITE_DODGE_TIME = 0.35;
export const NEMESITE_WARN_RANGE = 640;
export const NMEYE_TURN_MIN = 0.4;
export const NMEYE_TURN_MAX = 0.9;
/** Max random offset (radians) from the bearing to the player when an Nmeye picks a new heading. */
export const NMEYE_WOBBLE = 1;
export const ANTIMATTER_DRIFT = 160;
export const ANTIMATTER_SPIN = 3;
export const TRAILER_TURN_RATE = 1.5;
export const TRAILER_AMPLITUDE = 80;
export const SPORE_TRAILERS = 4;
export const STORM_ACID_DROPS = 5;
export const STORM_ACID_SPACING = 16;
/** Seconds between a Blunderstorm's rumble and its proton bolt. */
export const STORM_BOLT_DELAY = 0.8;
export const STORM_BOB = 20;

// Volcanoes (normal magma, and white-hot rocks while the planet is unstable)
export const MAGMA_RADIUS = 5;
export const MAGMA_INTERVAL_MIN = 2.5;
export const MAGMA_INTERVAL_MAX = 4;
export const MAGMA_VX_MIN = 60;
export const MAGMA_VX_MAX = 160;
export const MAGMA_VY_MIN = -380;
export const MAGMA_VY_MAX = -260;
export const HOT_ROCK_RADIUS = 8;
export const HOT_INTERVAL_MIN = 1;
export const HOT_INTERVAL_MAX = 1.8;
export const HOT_VY_MIN = -480;
export const HOT_VY_MAX = -340;

// Hazards
export const MAGMA_GRAVITY = 300;
export const ACID_SPEED = 220;
export const ACID_RADIUS = 4;
export const BOLT_WIDTH = 12;
export const BOLT_LIFE = 0.25;
export const EYE_BOMB_SPEED = 180;
export const EYE_BOMB_RADIUS = 5;

// Waves
/** Every 5th wave is a Trailer invasion; the wave after each one (from wave 6) is a shipment. */
export const INVASION_EVERY = 5;
export const INVASION_BASE_TRAILERS = 6;
export const INVASION_SPORES = 2;
/** Waves above this replay the last cycle (100 plays as 95, 101 as 96, ...). */
export const LAST_WAVE = 99;
export const CYCLE_START = 95;
export const WAVE_COMPLETE_TIME = 3;
/** Minimum horizontal distance from the player when spawning wave enemies. */
export const SPAWN_SAFE_DISTANCE = 700;

// Hit-stop durations (seconds)
export const HITSTOP_MULTI = 0.03;
export const HITSTOP_NMEYE = 0.04;
