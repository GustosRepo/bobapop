import { useRef, useCallback, useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { BossBrick, GameState } from '../game/types';
import { physicsStep, makeInitialBall, makeStickyBall, brickRect } from '../game/physics';
import { buildLevelBricks, LevelDef } from '../game/levels';
import {
  GAME_WIDTH,
  PADDLE_Y_OFFSET,
  GAME_HEIGHT,
  BALL_RADIUS,
  BOSS_WIDTH,
  BOSS_HEIGHT,
  BOSS_Y,
} from '../constants/gameConfig';
import { WORLDS } from '../constants/themes';
import { LEVELS } from '../game/levels';
import { useSound, _hapticsEnabled } from './useSound';

function buildInitialBoss(level: LevelDef): BossBrick | undefined {
  if (!level.isBoss) return undefined;
  return {
    hp: level.bossHp,
    maxHp: level.bossHp,
    x: (GAME_WIDTH - BOSS_WIDTH) / 2,
    y: BOSS_Y,
    width: BOSS_WIDTH,
    height: BOSS_HEIGHT,
    vx: level.bossSpeed,
    baseSpeed: level.bossSpeed,
    defeated: false,
    enraged: false,
  };
}

function buildInitialState(levelIndex: number, initialLives = 3): GameState {
  const level = LEVELS[levelIndex];
  const worldTheme = WORLDS[level?.worldIndex ?? 0];
  const paddleWidth = level?.paddleWidth ?? 90;
  const paddleX = GAME_WIDTH / 2 - paddleWidth / 2;
  const ball = makeInitialBall(paddleX, paddleWidth, level?.ballSpeed ?? 7);
  return {
    balls: [ball],
    paddle: { x: paddleX, width: paddleWidth },
    bricks: buildLevelBricks(levelIndex),
    particles: [],
    activePowerUps: [],
    score: 0,
    lives: initialLives,
    phase: 'idle',
    stickyCount: 3,
    bricksPopped: 0,
    boss: level ? buildInitialBoss(level) : undefined,
  };
}

export function useGameLoop(levelIndex: number, initialLives = 3) {
  const [gameState, setGameState] = useState<GameState>(() => buildInitialState(levelIndex, initialLives));
  const stateRef = useRef<GameState>(gameState);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const runningRef = useRef(false);

  const level = LEVELS[levelIndex];
  const worldTheme = WORLDS[level?.worldIndex ?? 0];
  const { playSound } = useSound();

  const syncState = useCallback((next: GameState) => {
    stateRef.current = next;
    setGameState(next);
  }, []);

  // ── Game Loop ──────────────────────────────────────────────────────────────
  const tick = useCallback((timestamp: number) => {
    if (!runningRef.current) return;
    const delta = lastTimeRef.current ? Math.min(timestamp - lastTimeRef.current, 32) : 16;
    lastTimeRef.current = timestamp;

    const next = physicsStep(stateRef.current, delta, worldTheme.particleColors);
    stateRef.current = next;
    setGameState(next);

    // ── Haptics + Sound ──────────────────────────────────────────────────────────
    if (next.hapticEvents && next.hapticEvents.length > 0) {
      for (const event of next.hapticEvents) {
        switch (event) {
          case 'brick_hit':
            if (_hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            playSound('brick_hit');
            break;
          case 'brick_destroy':
            if (_hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            playSound('brick_destroy');
            break;
          case 'paddle_hit':
            if (_hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            playSound('paddle_hit');
            break;
          case 'boss_hit':
            if (_hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            playSound('boss_hit');
            break;
          case 'boss_defeat':
            if (_hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            playSound('boss_defeat');
            break;
          case 'life_lost':
            if (_hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            playSound('life_lost');
            break;
          case 'game_won':
            if (_hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            playSound('game_won');
            break;
          case 'game_lost':
            if (_hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            playSound('game_lost');
            break;
        }
      }
    }

    if (next.phase === 'playing') {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      runningRef.current = false;
    }
  }, [worldTheme]);

  const startLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Public Actions ─────────────────────────────────────────────────────────

  const launchBall = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === 'idle') {
      const next: GameState = {
        ...s,
        phase: 'playing',
        balls: s.balls.map((b) =>
          b.sticky
            ? { ...b, sticky: false, stickyOffsetX: undefined }
            : b,
        ),
      };
      syncState(next);
      startLoop();
    } else if (s.phase === 'playing') {
      // release any sticky balls
      const hasStickyBall = s.balls.some((b) => b.sticky);
      if (hasStickyBall) {
        const next: GameState = {
          ...s,
          balls: s.balls.map((b) =>
            b.sticky
              ? { ...b, sticky: false, stickyOffsetX: undefined, vy: -Math.abs(b.vy || 7) }
              : b,
          ),
          stickyCount: Math.max(0, s.stickyCount - 1),
        };
        syncState(next);
      }
    }
  }, [syncState, startLoop]);

  const movePaddle = useCallback((screenX: number) => {
    const s = stateRef.current;
    const halfW = s.paddle.width / 2;
    const newX = Math.max(0, Math.min(GAME_WIDTH - s.paddle.width, screenX - halfW));
    stateRef.current = {
      ...s,
      paddle: { ...s.paddle, x: newX },
    };
    // Only trigger re-render when not playing (game loop handles it during play)
    if (s.phase !== 'playing') {
      setGameState(stateRef.current);
    }
  }, []);

  const resetLevel = useCallback(() => {
    stopLoop();
    const fresh = buildInitialState(levelIndex);
    syncState(fresh);
  }, [levelIndex, syncState, stopLoop]);

  const pauseGame = useCallback(() => {
    if (stateRef.current.phase !== 'playing') return;
    stopLoop();
    const next: GameState = { ...stateRef.current, phase: 'paused' };
    syncState(next);
  }, [stopLoop, syncState]);

  const resumeGame = useCallback(() => {
    if (stateRef.current.phase !== 'paused') return;
    const next: GameState = { ...stateRef.current, phase: 'playing' };
    syncState(next);
    startLoop();
  }, [startLoop, syncState]);

  useEffect(() => {
    const fresh = buildInitialState(levelIndex);
    syncState(fresh);
    return () => stopLoop();
  }, [levelIndex]);

  return {
    gameState,
    worldTheme,
    launchBall,
    movePaddle,
    resetLevel,
    pauseGame,
    resumeGame,
  };
}
