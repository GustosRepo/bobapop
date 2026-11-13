import { Ball, Brick, BossBrick, GameState, HapticEvent, Particle, ActivePowerUp, PowerUpType } from './types';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GAME_TOP_INSET,
  BALL_RADIUS,
  BALL_SPEED_MAX,
  PADDLE_HEIGHT,
  PADDLE_Y_OFFSET,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  BRICK_PADDING,
  BRICK_TOP_OFFSET,
  PARTICLE_COUNT,
  PARTICLE_LIFETIME,
  SLOW_MOTION_DURATION,
  WIDE_PADDLE_DURATION,
  STICKY_DURATION,
} from '../constants/gameConfig';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
const uid = () => `${++_idCounter}_${Date.now()}`;

export function brickRect(brick: Brick) {
  const totalBrickWidth = BRICK_WIDTH - BRICK_PADDING;
  const x = 16 + brick.col * BRICK_WIDTH + BRICK_PADDING / 2;
  const y = BRICK_TOP_OFFSET + (brick.rowOffset ?? 0) + brick.row * (BRICK_HEIGHT + BRICK_PADDING);
  return { x, y, w: totalBrickWidth, h: BRICK_HEIGHT };
}

export function paddleRect(state: GameState) {
  const py = GAME_HEIGHT - PADDLE_Y_OFFSET;
  return {
    x: state.paddle.x,
    y: py,
    w: state.paddle.width,
    h: PADDLE_HEIGHT,
  };
}

function clampVelocity(vx: number, vy: number) {
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed > BALL_SPEED_MAX) {
    const scale = BALL_SPEED_MAX / speed;
    return { vx: vx * scale, vy: vy * scale };
  }
  return { vx, vy };
}

// Resolve the contact face from the previous position, then separate the ball.
// Separation prevents another damage event while the ball is still inside a collider.
function reflectContact(x: number, y: number, vx: number, vy: number,
  previousX: number, previousY: number, rect: { x: number; y: number; w: number; h: number }) {
  const left = rect.x - BALL_RADIUS;
  const right = rect.x + rect.w + BALL_RADIUS;
  const top = rect.y - BALL_RADIUS;
  const bottom = rect.y + rect.h + BALL_RADIUS;
  let side: 'left' | 'right' | 'top' | 'bottom';
  if (previousY >= bottom) side = 'bottom';
  else if (previousY <= top) side = 'top';
  else if (previousX <= left) side = 'left';
  else if (previousX >= right) side = 'right';
  else {
    const distances = { left: Math.abs(x - left), right: Math.abs(right - x), top: Math.abs(y - top), bottom: Math.abs(bottom - y) };
    side = (Object.keys(distances) as Array<keyof typeof distances>)
      .reduce((nearest, candidate) => distances[candidate] < distances[nearest] ? candidate : nearest, 'top');
  }
  if (side === 'left') return { x: left - 0.01, y, vx: -Math.abs(vx), vy };
  if (side === 'right') return { x: right + 0.01, y, vx: Math.abs(vx), vy };
  if (side === 'top') return { x, y: top - 0.01, vx, vy: -Math.abs(vy) };
  return { x, y: bottom + 0.01, vx, vy: Math.abs(vy) };
}

// ─── Particle Factory ─────────────────────────────────────────────────────────

export function spawnParticles(
  x: number,
  y: number,
  colors: string[],
  count = PARTICLE_COUNT,
  kind: Particle['kind'] = 'boba',
  now = Date.now(),
): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3;
    return {
      id: uid(),
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      born: now,
      kind,
    };
  });
}

// ─── Physics Step ─────────────────────────────────────────────────────────────

function physicsSubstep(
  state: GameState,
  deltaMs: number,
  particleColors: string[],
): GameState {
  if (state.phase !== 'playing') return state;

  const now = (state.elapsedMs ?? 0) + deltaMs;
  const slowActive = state.activePowerUps.some(
    (p) => p.type === 'slow_motion' && p.expiresAt > now,
  );
  const speedMul = slowActive ? 0.45 : 1.0;
  const dt = (deltaMs / (1000 / 60)) * speedMul;

  // expire power-ups
  const activePowerUps = state.activePowerUps.filter((p) => p.expiresAt > now).map((p) => ({ ...p }));
  const wideActive = activePowerUps.some((p) => p.type === 'wide_paddle');
  const stickyActive = activePowerUps.some((p) => p.type === 'sticky_paddle');
  const paddleWidth = wideActive ? state.paddle.baseWidth * 1.6 : state.paddle.baseWidth;
  const paddleCenter = state.paddle.x + state.paddle.width / 2;

  const paddle = {
    ...state.paddle,
    x: Math.max(0, Math.min(GAME_WIDTH - paddleWidth, paddleCenter - paddleWidth / 2)),
    width: paddleWidth,
  };

  let newBricks = [...state.bricks];
  let newParticles = [...state.particles];
  let scoreGain = 0;
  const newBallsToAdd: Ball[] = [];
  let stickyCount = state.stickyCount;
  let bricksPoppedThisFrame = 0;
  // Copy boss so we can mutate it safely during ball loop
  let boss: BossBrick | undefined = state.boss ? { ...state.boss } : undefined;
  const hapticSet = new Set<HapticEvent>();
  const telemetryEvents: GameState['telemetryEvents'] = [];

  // ── update particles ─────────────────────────────────────────────────────
  newParticles = newParticles
    .map((p) => {
      const age = now - p.born;
      const alpha = Math.max(0, 1 - age / PARTICLE_LIFETIME);
      return { ...p, x: p.x + p.vx * deltaMs / (1000 / 60), y: p.y + p.vy * deltaMs / (1000 / 60), vy: p.vy + 0.08 * deltaMs / (1000 / 60), alpha };
    })
    .filter((p) => p.alpha > 0);

  // ── update balls ─────────────────────────────────────────────────────────
  const updatedBalls: Ball[] = state.balls.map((ball) => {
    if (!ball.active) return ball;
    if (ball.sticky) {
      // follow paddle
      const px = paddle.x + Math.max(BALL_RADIUS, Math.min(paddle.width - BALL_RADIUS, ball.stickyOffsetX ?? paddle.width / 2));
      return { ...ball, x: px, y: GAME_HEIGHT - PADDLE_Y_OFFSET - BALL_RADIUS };
    }

    let { x, y, vx, vy } = ball;
    x += vx * dt;
    y += vy * dt;

    // ── wall collisions ──────────────────────────────────────────────────
    if (x - BALL_RADIUS < 0) {
      x = BALL_RADIUS;
      vx = Math.abs(vx);
    }
    if (x + BALL_RADIUS > GAME_WIDTH) {
      x = GAME_WIDTH - BALL_RADIUS;
      vx = -Math.abs(vx);
    }
    if (y - BALL_RADIUS < GAME_TOP_INSET) {
      y = GAME_TOP_INSET + BALL_RADIUS;
      vy = Math.abs(vy);
    }

    // ── paddle collision ─────────────────────────────────────────────────
    const pr = paddleRect({ ...state, paddle, activePowerUps });
    if (
      vy > 0 &&
      y + BALL_RADIUS >= pr.y &&
      ball.y + BALL_RADIUS <= pr.y + 0.01 &&
      x >= pr.x - BALL_RADIUS &&
      x <= pr.x + pr.w + BALL_RADIUS
    ) {
      if (stickyActive && stickyCount > 0) {
        stickyCount -= 1;
        return {
          ...ball,
          x,
          y: pr.y - BALL_RADIUS,
          vx,
          vy,
          sticky: true,
          stickyOffsetX: x - paddle.x,
        };
      }
      hapticSet.add('paddle_hit');
      // angle based on where ball hits paddle (±60° max to prevent shallow traps)
      const hitPos = Math.max(0, Math.min(1, (x - pr.x) / pr.w)); // 0-1
      const angle = (hitPos - 0.5) * (Math.PI * 2) / 3; // -60° to +60°
      const speed = Math.sqrt(vx * vx + vy * vy);
      vx = Math.sin(angle) * speed;
      vy = -Math.abs(Math.cos(angle) * speed);
      // enforce minimum upward speed so ball never gets stuck horizontal
      if (Math.abs(vy) < speed * 0.4) {
        vy = -speed * 0.4;
        vx = Math.sign(vx) * Math.sqrt(speed * speed - vy * vy);
      }
      y = pr.y - BALL_RADIUS;
    }

    // ── brick collisions ─────────────────────────────────────────────────
    for (let i = 0; i < newBricks.length; i++) {
      const brick = newBricks[i];
      if (!brick.active) continue;

      const { x: bx, y: by, w: bw, h: bh } = brickRect(brick);
      const closestX = Math.max(bx, Math.min(x, bx + bw));
      const closestY = Math.max(by, Math.min(y, by + bh));
      const dx = x - closestX;
      const dy = y - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq < BALL_RADIUS * BALL_RADIUS) {
        const newHp = brick.hp - 1;
        const brickCenterX = bx + bw / 2;
        const brickCenterY = by + bh / 2;

        if (newHp <= 0) {
          newBricks[i] = { ...brick, active: false, hp: 0 };
          scoreGain += brick.maxHp * 10;
          bricksPoppedThisFrame++;
          hapticSet.add('brick_destroy');
          newParticles.push(
            ...spawnParticles(brickCenterX, brickCenterY, particleColors, PARTICLE_COUNT, 'splash', now),
          );

          // drop power-up
          if (brick.powerUp) {
            applyPowerUp(brick.powerUp, x, y, now, activePowerUps, newBallsToAdd, vx, vy);
            if (brick.powerUp === 'sticky_paddle') stickyCount = 3;
            telemetryEvents.push({ type: 'power_up_collected', powerUp: brick.powerUp });
          }
        } else {
          newBricks[i] = { ...brick, hp: newHp };
          hapticSet.add('brick_hit');
          newParticles.push(
            ...spawnParticles(brickCenterX, brickCenterY, particleColors, 4, 'boba', now),
          );
        }

        ({ x, y, vx, vy } = reflectContact(x, y, vx, vy, ball.x, ball.y, { x: bx, y: by, w: bw, h: bh }));
        break;
      }
    }
    // ── boss collision ─────────────────────────────────────────────────────────
    if (boss && !boss.defeated) {
      const { x: bx, y: by, width: bw, height: bh } = boss;
      const closestX = Math.max(bx, Math.min(x, bx + bw));
      const closestY = Math.max(by, Math.min(y, by + bh));
      const dx = x - closestX;
      const dy = y - closestY;
      if (dx * dx + dy * dy < BALL_RADIUS * BALL_RADIUS) {
        boss.hp -= 1;
        hapticSet.add('boss_hit');
        newParticles.push(
          ...spawnParticles(bx + bw / 2, by + bh / 2, particleColors, 6, 'burst', now),
        );
        if (boss.hp <= 0) {
          boss.defeated = true;
          hapticSet.add('boss_defeat');
          scoreGain += boss.maxHp * 50;
          // Mega burst on defeat
          newParticles.push(
            ...spawnParticles(bx + bw / 2, by + bh / 2, particleColors, 30, 'burst', now),
          );
        }
        ({ x, y, vx, vy } = reflectContact(x, y, vx, vy, ball.x, ball.y, { x: bx, y: by, w: bw, h: bh }));
      }
    }
    // ── out of bounds (bottom) ───────────────────────────────────────────
    if (y - BALL_RADIUS > GAME_HEIGHT) {
      return { ...ball, active: false };
    }

    const clamped = clampVelocity(vx, vy);
    vx = clamped.vx;
    vy = clamped.vy;
    return { ...ball, x, y, vx, vy };
  });

  // add multi-balls
  const allBalls = [...updatedBalls, ...newBallsToAdd];

  // ── boss movement ────────────────────────────────────────────────────────
  if (boss && !boss.defeated) {
    // Enrage when all regular bricks are cleared
    const normalBricksLeft = newBricks.filter((b) => b.active).length;
    if (normalBricksLeft === 0 && !boss.enraged) {
      boss.enraged = true;
      boss.vx = Math.sign(boss.vx || 1) * boss.baseSpeed * 1.8;
      telemetryEvents.push({ type: 'boss_enraged' });
    }
    boss.x += boss.vx * dt;
    if (boss.x < 0) {
      boss.x = 0;
      boss.vx = Math.abs(boss.vx);
    }
    if (boss.x + boss.width > GAME_WIDTH) {
      boss.x = GAME_WIDTH - boss.width;
      boss.vx = -Math.abs(boss.vx);
    }
  }

  // remove inactive balls and check lives
  const activeBalls = allBalls.filter((b) => b.active);
  let lives = state.lives;
  let phase: GameState['phase'] = state.phase;

  const cleared = !newBricks.some((brick) => brick.active) && (!boss || boss.defeated);
  if (activeBalls.length === 0 && !cleared) {
    lives -= 1;
    if (lives <= 0) {
      phase = 'lost';
    } else {
      // respawn a single sticky ball on paddle
      const respawn = makeStickyBall(paddle, state.ballSpeed);
      activeBalls.push(respawn);
    }
  }

  if (lives < state.lives) hapticSet.add('life_lost');
  if (lives < state.lives) telemetryEvents.push({ type: 'life_lost', livesRemaining: lives });

  const allActive = newBricks.filter((b) => b.active);
  const bossAlive = boss !== undefined && !boss.defeated;
  if (allActive.length === 0 && !bossAlive && phase === 'playing') {
    phase = 'won';
  }

  if (phase === 'won' && state.phase === 'playing') hapticSet.add('game_won');
  if (phase === 'lost' && state.phase === 'playing') hapticSet.add('game_lost');

  return {
    ...state,
    balls: activeBalls,
    paddle,
    bricks: newBricks,
    particles: newParticles,
    activePowerUps,
    score: state.score + scoreGain,
    lives,
    phase,
    boss,
    hapticEvents: hapticSet.size > 0 ? [...hapticSet] : [],
    telemetryEvents: telemetryEvents.length > 0 ? telemetryEvents : [],
    bricksPopped: (state.bricksPopped ?? 0) + bricksPoppedThisFrame,
    stickyCount,
    elapsedMs: now,
  };
}

// ─── Power-Up Application ─────────────────────────────────────────────────────

function applyPowerUp(
  type: PowerUpType,
  bx: number,
  by: number,
  now: number,
  activePowerUps: ActivePowerUp[],
  newBalls: Ball[],
  vx: number,
  vy: number,
) {
  switch (type) {
    case 'multi_ball': {
      const speed = Math.sqrt(vx * vx + vy * vy);
      pushOrRefresh(activePowerUps, 'multi_ball', now + 1500);
      newBalls.push({
        id: uid(),
        x: bx,
        y: by,
        vx: speed * Math.sin(Math.PI / 6),
        vy: -speed * Math.cos(Math.PI / 6),
        active: true,
        sticky: false,
        variant: 'multi',
      });
      newBalls.push({
        id: uid(),
        x: bx,
        y: by,
        vx: -speed * Math.sin(Math.PI / 6),
        vy: -speed * Math.cos(Math.PI / 6),
        active: true,
        sticky: false,
        variant: 'multi',
      });
      break;
    }
    case 'wide_paddle':
      pushOrRefresh(activePowerUps, 'wide_paddle', now + WIDE_PADDLE_DURATION);
      break;
    case 'sticky_paddle':
      pushOrRefresh(activePowerUps, 'sticky_paddle', now + STICKY_DURATION);
      break;
    case 'slow_motion':
      pushOrRefresh(activePowerUps, 'slow_motion', now + SLOW_MOTION_DURATION);
      break;
  }
}

function pushOrRefresh(list: ActivePowerUp[], type: PowerUpType, expiresAt: number) {
  const existing = list.find((p) => p.type === type);
  if (existing) {
    existing.expiresAt = expiresAt;
  } else {
    list.push({ type, expiresAt });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function makeInitialBall(paddleX: number, paddleWidth: number, speed = 7): Ball {
  return {
    id: uid(),
    x: paddleX + paddleWidth / 2,
    y: GAME_HEIGHT - PADDLE_Y_OFFSET - BALL_RADIUS,
    vx: Math.random() > 0.5 ? 1 : -1,
    vy: -Math.sqrt(Math.max(0, speed * speed - 1)),
    active: true,
    sticky: true,
    variant: 'default',
    stickyOffsetX: paddleWidth / 2,
  };
}

export function makeStickyBall(paddle: { x: number; width: number }, speed = 7): Ball {
  return {
    id: uid(),
    x: paddle.x + paddle.width / 2,
    y: GAME_HEIGHT - PADDLE_Y_OFFSET - BALL_RADIUS,
    vx: (Math.random() > 0.5 ? 1 : -1) * speed * 0.4,
    vy: -speed * Math.sqrt(1 - 0.4 ** 2),
    active: true,
    sticky: true,
    variant: 'default',
    stickyOffsetX: paddle.width / 2,
  };
}

export function physicsStep(state: GameState, deltaMs: number, particleColors: string[]): GameState {
  if (state.phase !== 'playing' || !Number.isFinite(deltaMs) || deltaMs <= 0) return state;
  const duration = Math.min(deltaMs, 64);
  const steps = Math.ceil(duration / 8);
  const haptics = new Set<HapticEvent>();
  const telemetry: NonNullable<GameState['telemetryEvents']> = [];
  let next = state;
  for (let i = 0; i < steps && next.phase === 'playing'; i++) {
    next = physicsSubstep(next, duration / steps, particleColors);
    next.hapticEvents?.forEach((event) => haptics.add(event));
    telemetry.push(...(next.telemetryEvents ?? []));
  }
  return { ...next, hapticEvents: [...haptics], telemetryEvents: telemetry };
}
