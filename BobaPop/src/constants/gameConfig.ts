// ─── Screen & Game Dimensions ────────────────────────────────────────────────
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 800;
export const GAME_TOP_INSET = 80; // Safe zone — ball won't go above this (accounts for notch/Dynamic Island)

// ─── Ball ─────────────────────────────────────────────────────────────────────
export const BALL_RADIUS = 10;
export const BALL_SPEED_INITIAL = 7;
export const BALL_SPEED_MAX = 14;

// ─── Paddle ───────────────────────────────────────────────────────────────────
export const PADDLE_WIDTH = 90;
export const PADDLE_HEIGHT = 14;
export const PADDLE_Y_OFFSET = 120; // distance from bottom
export const PADDLE_CORNER_RADIUS = 7;

// ─── Bricks ───────────────────────────────────────────────────────────────────
export const BRICK_COLS = 7;
export const BRICK_ROWS_MAX = 10;
export const BRICK_WIDTH = (GAME_WIDTH - 32) / BRICK_COLS;
export const BRICK_HEIGHT = 44;
export const BRICK_PADDING = 4;
export const BRICK_TOP_OFFSET = 180;
export const BRICK_CORNER_RADIUS = 8;

// ─── Power-up Chances ─────────────────────────────────────────────────────────
export const POWERUP_CHANCE = 0.18; // 18% chance per brick

// ─── Timing ───────────────────────────────────────────────────────────────────
export const SLOW_MOTION_DURATION = 4000; // ms
export const STICKY_DURATION = 3000; // ms (max sticks)
export const WIDE_PADDLE_DURATION = 8000; // ms

// ─── Boss ─────────────────────────────────────────────────────────────────────
export const BOSS_WIDTH  = 130;
export const BOSS_HEIGHT = 52;
// Boss Y sits at the very top of the brick field so it renders clearly
// below the HUD overlay (BRICK_TOP_OFFSET) and the ball can reach it
export const BOSS_Y      = BRICK_TOP_OFFSET;

// ─── Particles ────────────────────────────────────────────────────────────────
export const PARTICLE_COUNT = 10;
export const PARTICLE_LIFETIME = 600; // ms
