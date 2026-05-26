import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  PanResponder,
  Dimensions,
  StatusBar,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  Platform,
  View,
} from 'react-native';
import { IMAGES } from '../assets/images';
import { useGameLoop } from '../hooks/useGameLoop';
import { GameCanvas } from '../components/GameCanvas';
import { HUD } from '../components/HUD';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants/gameConfig';
import { LEVELS } from '../game/levels';
import { WORLDS } from '../constants/themes';
import { GameState } from '../game/types';

interface Props {
  levelIndex: number;
  onLevelComplete: (score: number, bricksPopped: number, lives: number) => void;
  onGameOver: (score: number, failedState: GameState) => void;
  onBack: () => void;
  initialLives?: number;
  resumeState?: GameState;
  seenOnboarding: Record<string, boolean>;
  onMarkOnboardingSeen: (key: string) => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');
const SCALE_X = SCREEN_W / GAME_WIDTH;
const SCALE_Y = SCREEN_H / GAME_HEIGHT;
// Safe area top inset — accounts for notch/Dynamic Island when StatusBar is hidden
const SAFE_TOP = Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 8;

export const GameScreen: React.FC<Props> = ({
  levelIndex,
  onLevelComplete,
  onGameOver,
  onBack,
  initialLives,
  resumeState,
  seenOnboarding,
  onMarkOnboardingSeen,
}) => {
  const {
    gameState,
    worldTheme,
    launchBall,
    movePaddle,
    resetLevel,
    pauseGame,
    resumeGame,
  } = useGameLoop(levelIndex, initialLives, resumeState);

  const level = LEVELS[levelIndex];
  const displayLevel = levelIndex + 1;
  const showLaunchHint = gameState.phase === 'idle' && levelIndex === 0 && !seenOnboarding.launch;

  // ── Screen shake ──────────────────────────────────────────────────────────
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback((magnitude: number, oscillations: number) => {
    shakeAnim.stopAnimation();
    shakeAnim.setValue(0);
    const d = magnitude > 5 ? 45 : 28;
    const steps: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < oscillations; i++) {
      const m = magnitude * (1 - i / (oscillations + 1));
      steps.push(
        Animated.timing(shakeAnim, { toValue: m, duration: d, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -m, duration: d * 2, useNativeDriver: true }),
      );
    }
    steps.push(Animated.timing(shakeAnim, { toValue: 0, duration: d, useNativeDriver: true }));
    Animated.sequence(steps).start();
  }, [shakeAnim]);

  const bossHpMountedRef = useRef(false);
  useEffect(() => {
    if (!bossHpMountedRef.current) {
      bossHpMountedRef.current = true;
      return;
    }
    const boss = gameState.boss;
    if (!boss) return;
    if (boss.defeated) {
      triggerShake(10, 5);
    } else {
      triggerShake(4, 2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.boss?.hp]);

  // Use refs so PanResponder always sees the latest callbacks
  const movePaddleRef = useRef(movePaddle);
  movePaddleRef.current = movePaddle;
  const launchBallRef = useRef(launchBall);
  launchBallRef.current = launchBall;
  const markOnboardingSeenRef = useRef(onMarkOnboardingSeen);
  markOnboardingSeenRef.current = onMarkOnboardingSeen;
  const seenOnboardingRef = useRef(seenOnboarding);
  seenOnboardingRef.current = seenOnboarding;

  // ── One-time onboarding nudges ─────────────────────────────────────────────
  const [onboardingToast, setOnboardingToast] = useState<string | null>(null);

  const showOnboardingToast = useCallback((key: string, message: string) => {
    if (seenOnboardingRef.current[key]) return;
    markOnboardingSeenRef.current(key);
    setOnboardingToast(message);
    const timer = setTimeout(() => setOnboardingToast((current) => (
      current === message ? null : current
    )), 3600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (levelIndex === 2) {
      return showOnboardingToast('powerup', 'Power-up block! Pop it for a boost.');
    }
    if (levelIndex === 4) {
      return showOnboardingToast('boss', 'Boss Boba! Clear blocks, then pop the boss.');
    }
    return undefined;
  }, [levelIndex, showOnboardingToast]);

  // ── Countdown 3-2-1 GO ──────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState<number | null>(3);
  const countdownActiveRef = useRef(true);
  countdownActiveRef.current = countdown !== null;

  useEffect(() => {
    const timers = [
      setTimeout(() => setCountdown(2), 850),
      setTimeout(() => setCountdown(1), 1700),
      setTimeout(() => setCountdown(0), 2550), // "GO!"
      setTimeout(() => setCountdown(null), 3100),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !countdownActiveRef.current,
      onMoveShouldSetPanResponder: () => !countdownActiveRef.current,
      onPanResponderGrant: (e) => {
        if (!seenOnboardingRef.current.launch) {
          markOnboardingSeenRef.current('launch');
        }
        movePaddleRef.current(e.nativeEvent.pageX / SCALE_X);
        launchBallRef.current();
      },
      onPanResponderMove: (_e, gestureState) => {
        movePaddleRef.current(gestureState.moveX / SCALE_X);
      },
    }),
  ).current;

  // Handle win/loss transitions
  React.useEffect(() => {
    if (gameState.phase === 'won') {
      const timer = setTimeout(() => onLevelComplete(gameState.score, gameState.bricksPopped, gameState.lives), 800);
      return () => clearTimeout(timer);
    }
    if (gameState.phase === 'lost') {
      const failedState = gameState;
      const timer = setTimeout(() => onGameOver(failedState.score, failedState), 800);
      return () => clearTimeout(timer);
    }
  }, [gameState, onGameOver, onLevelComplete]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <Animated.View
        style={[styles.canvasWrapper, { transform: [{ translateX: shakeAnim }] }]}
        {...panResponder.panHandlers}
      >
        <GameCanvas
          state={gameState}
          theme={worldTheme}
          width={SCREEN_W}
          height={SCREEN_H}
          scaleX={SCALE_X}
          scaleY={SCALE_Y}
        />

        {/* Launch hint */}
        {showLaunchHint && (
          <View style={styles.launchHint} pointerEvents="none">
            <Image source={IMAGES.lifeIcon} style={styles.launchBoba} resizeMode="contain" />
            <Text style={styles.launchText}>
              tap & drag to launch
            </Text>
          </View>
        )}
        {onboardingToast !== null && (
          <View style={styles.onboardingToast} pointerEvents="none">
            <Image source={IMAGES.lifeIcon} style={styles.toastIcon} resizeMode="contain" />
            <Text style={styles.toastText}>{onboardingToast}</Text>
          </View>
        )}
        {/* Countdown overlay */}
        {countdown !== null && (
          <View style={styles.countdownOverlay} pointerEvents="box-only">
            <Text style={[
              styles.countdownText,
              { color: worldTheme.ballColor },
              countdown === 0 && styles.countdownGo,
            ]}>
              {countdown === 0 ? 'GO!' : countdown}
            </Text>
          </View>
        )}

      </Animated.View>

      <View style={styles.hudOverlay} pointerEvents="box-none">
        <HUD
          score={gameState.score}
          lives={gameState.lives}
          level={displayLevel}
          worldName={worldTheme.name}
          activePowerUps={gameState.activePowerUps}
          theme={worldTheme}
          boss={gameState.boss && !gameState.boss.defeated ? gameState.boss : null}
          onPause={pauseGame}
        />
      </View>

      {/* Pause Modal */}
      <Modal visible={gameState.phase === 'paused'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: worldTheme.background[1] }]}>
            <Text style={[styles.modalTitle, { color: worldTheme.ballColor }]}>Paused</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: worldTheme.paddleColor }]}
              onPress={resumeGame}
            >
              <Text style={styles.modalBtnText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: worldTheme.paddleColor }]}
              onPress={resetLevel}
            >
              <Text style={styles.modalBtnText}>Restart</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <Text style={[styles.backText, { color: worldTheme.accentColor }]}>← Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#2A0F05',
  },
  canvasWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  hudOverlay: {
    position: 'absolute',
    top: SAFE_TOP,
    left: 0,
    right: 0,
  },
  launchHint: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
  },
  launchBoba: {
    width: 52,
    height: 52,
  },
  launchText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#FFFFFF',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  onboardingToast: {
    position: 'absolute',
    top: SAFE_TOP + 88,
    left: 24,
    right: 24,
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(43, 18, 8, 0.86)',
    borderWidth: 2,
    borderColor: 'rgba(255, 199, 91, 0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toastIcon: {
    width: 34,
    height: 34,
  },
  toastText: {
    flex: 1,
    color: '#FFF6E8',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: 280,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 14,
  },
  modalTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  backBtn: {
    marginTop: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  countdownText: {
    fontSize: 120,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },
  countdownGo: {
    fontSize: 80,
    letterSpacing: 4,
  },
});
