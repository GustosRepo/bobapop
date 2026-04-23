import React, { useRef } from 'react';
import { View, StyleSheet, Image, ImageBackground } from 'react-native';
import { GameState } from '../game/types';
import { WorldTheme } from '../constants/themes';
import { IMAGES } from '../assets/images';
import {
  GAME_HEIGHT,
  BALL_RADIUS,
  PADDLE_HEIGHT,
  PADDLE_Y_OFFSET,
  BOSS_WIDTH,
  BOSS_HEIGHT,
} from '../constants/gameConfig';
import { brickRect } from '../game/physics';

interface Props {
  state: GameState;
  theme: WorldTheme;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

export const GameCanvas: React.FC<Props> = ({ state, theme, width, height, scaleX, scaleY }) => {
  const paddleY = GAME_HEIGHT - PADDLE_Y_OFFSET;
  const getBallImage = (variant?: 'default' | 'hit' | 'hot' | 'multi') => {
    if (variant === 'multi') return IMAGES.ballMulti;
    if (variant === 'hot') return IMAGES.ballHot;
    if (variant === 'hit') return IMAGES.ballHit;
    return IMAGES.ball;
  };
  const getParticleImage = (kind?: 'boba' | 'splash' | 'burst') => {
    if (kind === 'splash') return IMAGES.effectSplash;
    if (kind === 'burst') return IMAGES.effectBurst;
    return IMAGES.particleBoba;
  };
  const getPowerUpImage = (type?: string) => {
    if (type === 'multi_ball') return IMAGES.ballMulti;
    if (type === 'wide_paddle') return IMAGES.paddleWide;
    if (type === 'sticky_paddle') return IMAGES.paddleSticky;
    if (type === 'slow_motion') return IMAGES.ballHot;
    return null;
  };

  // ── Ball trail history ──────────────────────────────────────────────────────
  // Keeps a ring of past positions per ball to render fading ghost frames.
  const trailHistoryRef = useRef<Map<string, Array<{ x: number; y: number }>>>(new Map());
  const trailHistory = trailHistoryRef.current;

  // Prune dead balls
  const activeBallIds = new Set(state.balls.filter((b) => b.active).map((b) => b.id));
  for (const id of trailHistory.keys()) {
    if (!activeBallIds.has(id)) trailHistory.delete(id);
  }

  // Build trail render data while updating history
  const TRAIL_LEN = 4;
  const trailFrames: { key: string; left: number; top: number; size: number; opacity: number; scale: number }[] = [];

  for (const ball of state.balls) {
    if (!ball.active || ball.sticky) {
      trailHistory.delete(ball.id);
      continue;
    }
    const hist = trailHistory.get(ball.id) ?? [];
    hist.push({ x: ball.x, y: ball.y });
    if (hist.length > TRAIL_LEN) hist.shift();
    trailHistory.set(ball.id, hist);

    // Render hist[0..len-2] as fading ghosts (hist[len-1] = current, rendered as main ball)
    const size = BALL_RADIUS * 2 * scaleX;
    for (let i = 0; i < hist.length - 1; i++) {
      const ageFraction = (i + 1) / hist.length; // 0 = oldest, approaches 1 = most recent ghost
      trailFrames.push({
        key: `trail_${ball.id}_${i}`,
        left: (hist[i].x - BALL_RADIUS) * scaleX,
        top: (hist[i].y - BALL_RADIUS) * scaleY,
        size,
        opacity: ageFraction * 0.45,
        scale: 0.45 + ageFraction * 0.45,
      });
    }
  }

  const isSticky = state.activePowerUps.some((p) => p.type === 'sticky_paddle');
  const isWide   = state.activePowerUps.some((p) => p.type === 'wide_paddle');
  const isSlow   = state.activePowerUps.some((p) => p.type === 'slow_motion');
  const paddleImage = isSticky ? IMAGES.paddleSticky
                    : isWide   ? IMAGES.paddleWide
                    : isSlow   ? IMAGES.paddleSlow
                    : IMAGES.paddle;

  // ── Brick crack flash ──────────────────────────────────────────────────────
  // When a brick’s HP drops we record the frame time; a white overlay is shown for FLASH_MS.
  const FLASH_MS = 120;
  const brickFlashRef = useRef<Map<string, { prevHp: number; flashStart: number }>>(new Map());
  const brickFlash = brickFlashRef.current;
  const now = Date.now();

  // ── Boss enrage flash ──────────────────────────────────────────────────────
  const bossEnrageRef = useRef<{ wasEnraged: boolean; flashStart: number }>({ wasEnraged: false, flashStart: 0 });
  if (state.boss && !state.boss.defeated) {
    if (state.boss.enraged && !bossEnrageRef.current.wasEnraged) {
      bossEnrageRef.current.flashStart = now;
    }
    bossEnrageRef.current.wasEnraged = state.boss.enraged;
  } else {
    bossEnrageRef.current.wasEnraged = false;
  }

  // Clean up stale entries for bricks that are gone this frame
  const activeBrickIds = new Set(state.bricks.filter((b) => b.active).map((b) => b.id));
  for (const id of brickFlash.keys()) {
    if (!activeBrickIds.has(id)) brickFlash.delete(id);
  }

  // Update flash state for each active brick
  for (const brick of state.bricks) {
    if (!brick.active) continue;
    const entry = brickFlash.get(brick.id);
    if (!entry) {
      brickFlash.set(brick.id, { prevHp: brick.hp, flashStart: 0 });
    } else if (brick.hp < entry.prevHp) {
      entry.flashStart = now;
      entry.prevHp = brick.hp;
    } else {
      entry.prevHp = brick.hp;
    }
  }

  return (
    <ImageBackground
      source={theme.bgImage}
      style={[styles.container, { width, height }]}
      resizeMode="cover"
    >
      {/* Bricks */}
      {state.bricks.map((brick) => {
        if (!brick.active) return null;
        const r = brickRect(brick);
        // HP determines the base art so the actual block assets show consistently.
        const blockImg = IMAGES.blocks[Math.min(Math.max(brick.maxHp, 1), IMAGES.blocks.length) - 1];
        const opacity = 0.5 + (brick.hp / brick.maxHp) * 0.5;
        const flashEntry = brickFlash.get(brick.id);
        const isFlashing = flashEntry ? (now - flashEntry.flashStart) < FLASH_MS : false;
        const pulseScale = brick.powerUp ? 1 + 0.07 * Math.abs(Math.sin(now / 500)) : 1;
        const brickW = r.w * scaleX;
        const brickH = r.h * scaleY;
        const artSize = Math.min(brickW, brickH * 1.38);
        const powerUpImage = getPowerUpImage(brick.powerUp);

        return (
          <View
            key={brick.id}
            style={[
              styles.brick,
              brick.powerUp ? styles.brickPowerUp : undefined,
              {
                left: r.x * scaleX,
                top: r.y * scaleY,
                width: brickW,
                height: brickH,
                opacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          >
            <Image
              source={blockImg}
              style={{ width: artSize, height: artSize }}
              resizeMode="contain"
            />
            {isFlashing && (
              <View style={[StyleSheet.absoluteFill, styles.brickFlash]} />
            )}
            {powerUpImage && (
              <View style={styles.powerUpBadge}>
                <Image source={powerUpImage} style={styles.powerUpBadgeIcon} resizeMode="contain" />
              </View>
            )}
          </View>
        );
      })}

      {/* Ball trail (ghost frames behind each ball) */}
      {trailFrames.map((f) => (
        <Image
          key={f.key}
          source={IMAGES.ball}
          style={[styles.ball, {
            left: f.left,
            top: f.top,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            transform: [{ scale: f.scale }],
          }]}
          resizeMode="contain"
        />
      ))}

      {/* Balls */}
      {state.balls.map((ball) => {
        if (!ball.active) return null;
        const isMultiBall = ball.variant === 'multi';
        const hitSize = BALL_RADIUS * 2 * scaleX;
        if (isMultiBall) {
          const bladeSize = hitSize * 0.50;
          const orbitRadius = hitSize * 0.25;
          const spin = now / 55;
          const centerX = ball.x * scaleX;
          const centerY = ball.y * scaleY;

          return (
            <View
              key={ball.id}
              pointerEvents="none"
              style={[
                styles.ball,
                {
                  left: centerX - orbitRadius - bladeSize / 2,
                  top: centerY - orbitRadius - bladeSize / 2,
                  width: orbitRadius * 2 + bladeSize,
                  height: orbitRadius * 2 + bladeSize,
                },
              ]}
            >
              {[0, 1, 2].map((i) => {
                const angle = spin + i * (Math.PI * 2 / 3);
                const x = orbitRadius + Math.cos(angle) * orbitRadius;
                const y = orbitRadius + Math.sin(angle) * orbitRadius;
                return (
                  <Image
                    key={i}
                    source={IMAGES.ball}
                    style={[
                      styles.multiBlade,
                      {
                        left: x,
                        top: y,
                        width: bladeSize,
                        height: bladeSize,
                      },
                    ]}
                    resizeMode="contain"
                  />
                );
              })}
            </View>
          );
        }

        const visualSize = hitSize;
        return (
          <Image
            key={ball.id}
            source={getBallImage(ball.variant)}
            style={[
              styles.ball,
              {
                left: ball.x * scaleX - visualSize / 2,
                top: ball.y * scaleY - visualSize / 2,
                width: visualSize,
                height: visualSize,
              },
            ]}
            resizeMode="contain"
          />
        );
      })}

      {/* Paddle */}
      <Image
        source={paddleImage}
        style={[
          styles.paddle,
          {
            left: state.paddle.x * scaleX,
            top: paddleY * scaleY,
            width: state.paddle.width * scaleX,
            height: PADDLE_HEIGHT * scaleY * 2.8,
          },
        ]}
        resizeMode="stretch"
      />

      {/* Particles */}
      {state.particles.map((p) => {
        const isEffect = p.kind === 'splash' || p.kind === 'burst';
        const size = isEffect ? p.radius * 14 * scaleX : p.radius * 2 * scaleX;
        const effectAngle = `${Math.atan2(p.vy, p.vx) + Math.PI}rad`;
        return (
          <Image
            key={p.id}
            source={getParticleImage(p.kind)}
            style={{
              position: 'absolute',
              left: (p.x - size / (2 * scaleX)) * scaleX,
              top: (p.y - size / (2 * scaleY)) * scaleY,
              width: size,
              height: size,
              opacity: p.alpha,
              transform: isEffect ? [{ rotate: effectAngle }] : undefined,
            }}
            resizeMode="contain"
          />
        );
      })}

      {/* Boss Brick */}
      {state.boss && !state.boss.defeated && (() => {
        const b = state.boss;
        const hpRatio = b.hp / b.maxHp;
        // Pulse opacity between 0.85–1.0 based on enrage state — just a static visual cue
        const bossOpacity = b.enraged ? 1.0 : 0.88 + hpRatio * 0.12;
        return (
          <View
            style={[
              styles.bossContainer,
              {
                left: b.x * scaleX,
                top: b.y * scaleY,
                width: b.width * scaleX,
                height: b.height * scaleY,
                opacity: bossOpacity,
              },
            ]}
          >
            {/* Boss image */}
            <Image
              source={IMAGES.boss}
              style={{ width: b.width * scaleX, height: b.height * scaleY }}
              resizeMode="contain"
            />
            {/* Enrage flash + continuous pulse overlay */}
            {(() => {
              const ENRAGE_FLASH_MS = 500;
              const enrageFlashActive = (now - bossEnrageRef.current.flashStart) < ENRAGE_FLASH_MS;
              const enragePulseAlpha = b.enraged && !enrageFlashActive
                ? 0.12 + 0.15 * Math.abs(Math.sin(now / 200))
                : 0;
              if (!enrageFlashActive && enragePulseAlpha === 0) return null;
              return (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: '#FF3030',
                      opacity: enrageFlashActive ? 0.55 : enragePulseAlpha,
                    },
                  ]}
                />
              );
            })()}
          </View>
        );
      })()}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  brick: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 6,
  },
  brickFlash: {
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  brickPowerUp: {
    borderWidth: 1,
    borderColor: '#F5C542',
    borderRadius: 4,
    shadowColor: '#F5C542',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 7,
    elevation: 6,
  },
  powerUpBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 20,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(42, 15, 5, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  powerUpBadgeIcon: {
    width: 17,
    height: 13,
  },
  ball: {
    position: 'absolute',
  },
  multiBlade: {
    position: 'absolute',
  },
  paddle: {
    position: 'absolute',
  },
  bossContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
