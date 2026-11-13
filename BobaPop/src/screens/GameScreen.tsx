import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  BackHandler,
  StatusBar,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { IMAGES } from '../assets/images';
import { useGameKeyboard } from '../hooks/useGameKeyboard';
import { useGameLoop } from '../hooks/useGameLoop';
import { GameCanvas } from '../components/GameCanvas';
import { HUD } from '../components/HUD';
import { fitGameViewport, paddleXFromWindow } from '../game/viewport';
import { LEVELS } from '../game/levels';
import { GameState } from '../game/types';

interface Props {
  levelIndex: number;
  onLevelComplete: (score: number, bricksPopped: number, lives: number) => void;
  onGameOver: (score: number, failedState: GameState) => void;
  onBack: () => void;
  onRestart: () => void;
  initialLives?: number;
  resumeState?: GameState;
  energy: number;
  unlimitedEnergy: boolean;
  maxEnergy: number;
  nextEnergyInMs: number;
  seenOnboarding: Record<string, boolean>;
  onMarkOnboardingSeen: (key: string) => void;
}

export const GameScreen: React.FC<Props> = ({
  levelIndex,
  onLevelComplete,
  onGameOver,
  onBack,
  onRestart,
  initialLives,
  resumeState,
  energy,
  unlimitedEnergy,
  maxEnergy,
  nextEnergyInMs,
  seenOnboarding,
  onMarkOnboardingSeen,
}) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const windowLeftRef = useRef(0);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const viewport = fitGameViewport(size.width, size.height, insets);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const onLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setSize(current => current.width === layout.width && current.height === layout.height
      ? current : { width: layout.width, height: layout.height });
    rootRef.current?.measureInWindow(x => { windowLeftRef.current = x; });
  }, []);
  const {

    gameState,
    worldTheme,
    launchBall,
    movePaddle,
    pauseGame,
    resumeGame,
  } = useGameLoop(levelIndex, initialLives, resumeState);

  const resizeKey = [size.width, size.height, insets.top, insets.right, insets.bottom, insets.left].join(':');
  const previousSizeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!size.width || !size.height) return;
    if (previousSizeRef.current !== null && previousSizeRef.current !== resizeKey) pauseGame();
    previousSizeRef.current = resizeKey;
  }, [resizeKey, size.width, size.height, pauseGame]);

  const displayLevel = levelIndex + 1;
  const levelName = LEVELS[levelIndex]?.name;
  const showLaunchHint = gameState.phase === 'idle' && levelIndex === 0 && !seenOnboarding.launch;
  const nextEnergyMinutes = Math.ceil(nextEnergyInMs / 60000);
  const canRestart = unlimitedEnergy || energy > 0;

  // ── Screen shake ──────────────────────────────────────────────────────────
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback((magnitude: number, oscillations: number) => {
    if (reducedMotion) return;
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
  }, [shakeAnim, reducedMotion]);

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
  const inputEnabledRef = useRef(false);
  inputEnabledRef.current = viewport.scale > 0 && countdown === null
    && (gameState.phase === 'idle' || gameState.phase === 'playing');

  useEffect(() => {
    const timers = [
      setTimeout(() => setCountdown(2), 850),
      setTimeout(() => setCountdown(1), 1700),
      setTimeout(() => setCountdown(0), 2550), // "GO!"
      setTimeout(() => setCountdown(null), 3100),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useGameKeyboard(countdown === null && (gameState.phase === 'playing' || gameState.phase === 'idle'),
    (delta) => movePaddle(gameState.paddle.x + gameState.paddle.width / 2 + delta), launchBall, pauseGame);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => inputEnabledRef.current,
      onMoveShouldSetPanResponder: () => inputEnabledRef.current,
      onPanResponderGrant: (e) => {
        if (!inputEnabledRef.current) return;
        if (!seenOnboardingRef.current.launch) {
          markOnboardingSeenRef.current('launch');
        }
        movePaddleRef.current(paddleXFromWindow(e.nativeEvent.pageX, windowLeftRef.current, viewportRef.current));
        launchBallRef.current();
      },
      onPanResponderMove: (_e, gestureState) => {
        if (!inputEnabledRef.current) return;
        movePaddleRef.current(paddleXFromWindow(gestureState.moveX, windowLeftRef.current, viewportRef.current));
      },
    }),
  ).current;

  const phaseRef = useRef(gameState.phase);
  phaseRef.current = gameState.phase;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phaseRef.current === 'won' || phaseRef.current === 'lost') return true;
      pauseGame();
      return true;
    });
    return () => subscription.remove();
  }, [pauseGame]);

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
    <View ref={rootRef} onLayout={onLayout} style={styles.root}>
      <StatusBar hidden />
      <Image source={worldTheme.bgImage} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={18} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,8,2,0.55)' }]} />

      {viewport.scale > 0 && <>
      <Animated.View
        testID="game-board"
        style={[styles.canvasWrapper, { left: viewport.left, top: viewport.top, width: viewport.width, height: viewport.height, transform: [{ translateX: shakeAnim }] }]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Boba game paddle"
        accessibilityHint="Adjust left or right to move. Activate to launch the ball."
        accessibilityActions={[{ name: 'increment', label: 'Move right' }, { name: 'decrement', label: 'Move left' }, { name: 'activate', label: 'Launch ball' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (!inputEnabledRef.current) return;
          if (nativeEvent.actionName === 'activate') launchBall();
          else movePaddle(gameState.paddle.x + gameState.paddle.width / 2 + (nativeEvent.actionName === 'increment' ? 30 : -30));
        }}
        {...panResponder.panHandlers}
      >
        <GameCanvas
          state={gameState}
          theme={worldTheme}
          width={viewport.width}
          height={viewport.height}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
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
          <View style={[styles.onboardingToast, { top: 112 * viewport.scale }]} pointerEvents="none">
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
            {levelName && <Text style={styles.levelName}>{levelName}</Text>}
          </View>
        )}

      </Animated.View>

      <View style={[styles.hudOverlay, { top: viewport.hudTop, left: viewport.hudLeft, width: viewport.hudWidth }]} pointerEvents="box-none">
        <HUD
          score={gameState.score}
          lives={gameState.lives}
          level={displayLevel}
          levelName={levelName}
          worldName={worldTheme.name}
          activePowerUps={gameState.activePowerUps}
          theme={worldTheme}
          compact={viewport.hudWidth < 360 || viewport.scale < 0.9}
          stacked={viewport.hudBesideBoard}
          boss={gameState.boss && !gameState.boss.defeated ? gameState.boss : null}
          onPause={pauseGame}
        />
      </View>
      </>}

      {/* Pause Modal */}
      <Modal visible={gameState.phase === 'paused'} transparent animationType={reducedMotion ? "none" : "fade"} onRequestClose={resumeGame}>
        <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
          <ScrollView style={[styles.modal, { backgroundColor: worldTheme.background[1] }]} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: worldTheme.ballColor }]}>Paused</Text>
            <TouchableOpacity accessibilityRole="button"
              style={[styles.modalBtn, { backgroundColor: worldTheme.paddleColor }]}
              onPress={resumeGame}
            >
              <Text style={styles.modalBtnText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              style={[
                styles.modalBtn,
                !canRestart && styles.modalBtnDisabled,
                { backgroundColor: worldTheme.paddleColor },
              ]}
              onPress={onRestart}
              disabled={!canRestart}
            >
              <Text style={styles.modalBtnText}>
                {unlimitedEnergy ? 'Restart · Unlimited Energy' : canRestart
                  ? `Restart - Energy ${energy}/${maxEnergy}`
                  : `Next energy in ${nextEnergyMinutes}m`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.backBtn} onPress={onBack}>
              <Text style={[styles.backText, { color: worldTheme.accentColor }]}>← Menu</Text>
            </TouchableOpacity>
          </ScrollView>
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
    right: 0,
    bottom: 0,

    backgroundColor: '#2A0F05',
    overflow: 'hidden',
  },
  canvasWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,

  },
  hudOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
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
    top: 88,
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
    width: '100%',
    maxWidth: 320,
    maxHeight: '100%',
    flexGrow: 0,
    borderRadius: 24,
  },
  modalContent: {
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
  modalBtnDisabled: {
    opacity: 0.55,
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
  levelName: { color: '#FFF6E8', fontSize: 22, fontWeight: '800', textAlign: 'center', paddingHorizontal: 24 },
  countdownGo: {
    fontSize: 80,
    letterSpacing: 4,
  },
});
