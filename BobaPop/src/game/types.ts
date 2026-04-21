export type PowerUpType = 'multi_ball' | 'wide_paddle' | 'sticky_paddle' | 'slow_motion';

export interface Brick {
  id: string;
  col: number;
  row: number;
  hp: number;        // hits remaining
  maxHp: number;
  active: boolean;
  powerUp?: PowerUpType;
  rowOffset?: number; // extra y offset in game coords (used on boss levels)
}

export interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  sticky: boolean;   // stuck to paddle waiting for launch
  stickyOffsetX?: number;
}

export interface Paddle {
  x: number;
  width: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  born: number;
}

export interface ActivePowerUp {
  type: PowerUpType;
  expiresAt: number;
}

export interface BossBrick {
  hp: number;
  maxHp: number;
  x: number;         // left edge in game coords
  y: number;         // top edge in game coords
  width: number;
  height: number;
  vx: number;        // horizontal velocity (signed)
  baseSpeed: number; // positive base speed for enrage calculation
  defeated: boolean;
  enraged: boolean;
}

export type HapticEvent =
  | 'brick_hit'
  | 'brick_destroy'
  | 'paddle_hit'
  | 'boss_hit'
  | 'boss_defeat'
  | 'life_lost'
  | 'game_won'
  | 'game_lost';

export interface GameState {
  balls: Ball[];
  paddle: Paddle;
  bricks: Brick[];
  particles: Particle[];
  activePowerUps: ActivePowerUp[];
  score: number;
  lives: number;
  phase: 'idle' | 'playing' | 'paused' | 'won' | 'lost';
  stickyCount: number; // how many more times sticky can catch
  boss?: BossBrick;
  hapticEvents?: HapticEvent[];
  bricksPopped: number; // total bricks destroyed this level run
}
