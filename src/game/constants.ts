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
export const EXTRA_LIFE_EVERY = 10000;
export const START_BOMBS = 3;
export const MAX_BOMBS = 5;
/** Cloak meter drained per second while active (meter is 0..1, so 4 s total). */
export const CLOAK_DRAIN = 0.25;
/** Shield (cloak) seconds at the start of a game. */
export const SHIELD_START = 7;
export const RESPAWN_DELAY = 2;
export const RESPAWN_INVULN = 2;

// Men and base
export const MEN_PER_WAVE = 8;
export const MAN_RADIUS = 8;
export const MAN_WALK_SPEED = 18;
export const MAN_FALL_GRAVITY = 300;
export const MAN_SAFE_FALL = 200;
export const MAN_CARRY_OFFSET = 26;
export const SNATCH_CARRY_OFFSET = 20;
export const RESCUE_POINTS = 500;
export const CATCH_POINTS = 250;
export const BASE_WIDTH = 160;
/** Player must be within this height above the pad surface to deliver a man. */
export const BASE_DELIVERY_HEIGHT = 70;
export const WAVE_BONUS_PER_MAN = 100;

// Scoring
export const COMBO_WINDOW = 1.5;
export const MAX_MULTIPLIER = 8;

// Enemies
export const ENEMY_SHOT_SPEED = 380;
export const ENEMY_SHOT_LIFE = 3;
export const TRAIL_LIFE = 1.5;
export const TRAIL_INTERVAL = 0.05;
export const TRAIL_RADIUS = 6;
export const HUNTER_DELAY = 60;
export const HUNTER_REPEAT = 20;
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

// Hazards
export const MAGMA_GRAVITY = 300;
export const ACID_SPEED = 220;
export const ACID_RADIUS = 4;
export const BOLT_WIDTH = 12;
export const BOLT_LIFE = 0.25;
export const EYE_BOMB_SPEED = 180;
export const EYE_BOMB_RADIUS = 5;

// Waves
export const MILESTONE_EVERY = 5;
export const WAVE_COMPLETE_TIME = 3;
/** Seconds into a wave before any snatcher may target a man. */
export const SNATCH_GRACE = 8;
/** Minimum horizontal distance from the player when spawning wave enemies. */
export const SPAWN_SAFE_DISTANCE = 700;

// Hit-stop durations (seconds)
export const HITSTOP_MULTI = 0.03;
export const HITSTOP_HUNTER = 0.04;
