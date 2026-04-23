import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, StatusBar, Text, Image, Animated, Alert } from 'react-native';
import { GameScreen } from './src/screens/GameScreen';
import { LevelSelectScreen } from './src/screens/LevelSelectScreen';
import { LevelCompleteScreen } from './src/screens/LevelCompleteScreen';
import { GameOverScreen } from './src/screens/GameOverScreen';
import { WORLDS } from './src/constants/themes';
import { LEVELS } from './src/game/levels';
import { useSaveData } from './src/hooks/useSaveData';
import { IMAGES } from './src/assets/images';
import { WorldIntroModal } from './src/components/WorldIntroModal';
import { PlusPaywallModal } from './src/components/PlusPaywallModal';
import { preloadSounds } from './src/hooks/useSound';
import { setSoundEnabled, setHapticsEnabled } from './src/hooks/useSound';
import { preloadMusic, playMusic, setMusicEnabled } from './src/hooks/useMusic';
import { AppState, AppStateStatus } from 'react-native';
import { pauseMusic, resumeMusic } from './src/hooks/useMusic';
import { useRewardedAd } from './src/hooks/useRewardedAd';
import { getContinueOffer } from './src/monetization/continueSystem';
import {
  trackContinueAccepted,
  trackContinueOffer,
  trackGameOverExit,
  trackLevelFail,
  trackRewardedAdResult,
} from './src/analytics/gameAnalytics';
import { PlusPlanId } from './src/monetization/plus';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');

// ─── DEV ─────────────────────────────────────────────────────────────────────
const DEV_UNLOCK_ALL = false; // set to false before shipping
// ─────────────────────────────────────────────────────────────────────────────

type Screen =
  | { name: 'select' }
  | { name: 'game'; levelIndex: number; runId: number; initialLives?: number }
  | { name: 'complete'; score: number; stars: number; levelIndex: number }
  | { name: 'over'; score: number; levelIndex: number; runId: number };

/** Stars based on lives remaining — standard for casual arcade games */
function livesToStars(lives: number): number {
  if (lives >= 3) return 3;
  if (lives >= 2) return 2;
  return 1;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'select' });
  const [nextRunId, setNextRunId] = useState(1);
  const [runContinues, setRunContinues] = useState<Record<number, number>>({});
  const [plusPaywallVisible, setPlusPaywallVisible] = useState(false);
  const [
    worldIntro,
    setWorldIntro,
  ] = useState<{ worldIndex: number; levelIndex: number } | null>(null);

  useEffect(() => {
    preloadSounds().catch(() => {});
    preloadMusic().catch(() => {});
  }, []);

  // ── App background / foreground — pause music when backgrounded ────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') resumeMusic();
      else pauseMusic();
    });
    return () => sub.remove();
  }, []);

  const {
    loading, unlockedUpTo, levelStars, levelHighScores, totalBobas,
    seenWorlds, soundEnabled, hapticsEnabled, adsRemoved, seenOnboarding,
    recordLevelComplete, markWorldSeen, markOnboardingSeen, updateSettings, unlockAdsRemoved,
  } = useSaveData(DEV_UNLOCK_ALL, LEVELS.length);

  const { isLoaded: rewardedAdLoaded, showAd } = useRewardedAd();

  useEffect(() => {
    setSoundEnabled(soundEnabled);
    setHapticsEnabled(hapticsEnabled);
    setMusicEnabled(soundEnabled);
  }, [soundEnabled, hapticsEnabled]);

  // ── Music — react to screen changes ────────────────────────────────────────
  useEffect(() => {
    if (screen.name === 'select') {
      playMusic('menu');
    } else if (screen.name === 'game') {
      const isBoss = LEVELS[screen.levelIndex]?.isBoss ?? false;
      playMusic(isBoss ? 'boss' : 'game');
    } else if (screen.name === 'over') {
      playMusic('gameover');
    }
    // 'complete' keeps whatever track was playing
  }, [screen]);

  useEffect(() => {
    if (screen.name !== 'over') return;
    const continuesUsed = runContinues[screen.runId] ?? 0;
    const offer = getContinueOffer(screen.levelIndex, continuesUsed, adsRemoved);
    if (offer.canShow) {
      trackContinueOffer(screen.levelIndex, offer.continueNumber, offer.rewardLives);
    }
  }, [adsRemoved, runContinues, screen]);

  // ── Screen fade transition ──────────────────────────────────────────────────────
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const navigateTo = useCallback((newScreen: Screen) => {
    Animated.timing(screenOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setScreen(newScreen);
      Animated.timing(screenOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }, [screenOpacity]);

  const startLevel = useCallback((levelIndex: number, initialLives?: number, runId?: number) => {
    const resolvedRunId = runId ?? nextRunId;
    if (runId === undefined) {
      setNextRunId((id) => id + 1);
      setRunContinues((prev) => ({ ...prev, [resolvedRunId]: 0 }));
    }
    navigateTo({ name: 'game', levelIndex, runId: resolvedRunId, initialLives });
  }, [navigateTo, nextRunId]);

  const handleSelectLevel = useCallback((index: number) => {
    const worldIndex = LEVELS[index]?.worldIndex ?? 0;
    if (!seenWorlds.includes(worldIndex)) {
      // Show world intro before entering the first level of a new world
      setWorldIntro({ worldIndex, levelIndex: index });
    } else {
      startLevel(index);
    }
  }, [seenWorlds, startLevel]);

  const handleWorldIntroDone = useCallback(() => {
    if (!worldIntro) return;
    markWorldSeen(worldIntro.worldIndex);
    const levelIndex = worldIntro.levelIndex;
    setWorldIntro(null);
    startLevel(levelIndex);
  }, [worldIntro, markWorldSeen, startLevel]);

  const handleLevelComplete = useCallback(
    (score: number, bricksPopped: number, lives: number) => {
      if (screen.name !== 'game') return;
      const idx = screen.levelIndex;
      const earned = livesToStars(lives);
      recordLevelComplete(idx, earned, score, bricksPopped);
      navigateTo({ name: 'complete', score, stars: earned, levelIndex: idx });
    },
    [screen, recordLevelComplete, navigateTo],
  );

  const handleGameOver = useCallback(
    (score: number) => {
      if (screen.name !== 'game') return;
      const continuesUsed = runContinues[screen.runId] ?? 0;
      trackLevelFail(screen.levelIndex, score, continuesUsed);
      navigateTo({ name: 'over', score, levelIndex: screen.levelIndex, runId: screen.runId });
    },
    [screen, navigateTo, runContinues],
  );

  const handleContinue = useCallback(() => {
    if (screen.name !== 'over') return;
    const { levelIndex, runId } = screen;
    const continuesUsed = runContinues[runId] ?? 0;
    const offer = getContinueOffer(levelIndex, continuesUsed, adsRemoved);
    if (!offer.canShow) return;

    trackContinueAccepted(levelIndex, offer.continueNumber, offer.rewardLives);

    if (offer.reason === 'ads_removed') {
      setRunContinues((prev) => ({ ...prev, [runId]: continuesUsed + 1 }));
      startLevel(levelIndex, offer.rewardLives, runId);
      return;
    }

    showAd((result) => {
      trackRewardedAdResult(levelIndex, offer.continueNumber, result);
      if (result !== 'watched') return;
      setRunContinues((prev) => ({ ...prev, [runId]: continuesUsed + 1 }));
      startLevel(levelIndex, offer.rewardLives, runId);
    });
  }, [adsRemoved, runContinues, screen, showAd, startLevel]);

  const handleRetryFromGameOver = useCallback(() => {
    if (screen.name !== 'over') return;
    trackGameOverExit(screen.levelIndex, 'retry');
    startLevel(screen.levelIndex);
  }, [screen, startLevel]);

  const handleLevelSelectFromGameOver = useCallback(() => {
    if (screen.name !== 'over') return;
    trackGameOverExit(screen.levelIndex, 'level_select');
    navigateTo({ name: 'select' });
  }, [screen, navigateTo]);

  const handleSelectPlusPlan = useCallback((planId: PlusPlanId) => {
    // Temporary local activation for testing the paywall flow.
    // Replace this with the real StoreKit purchase call before App Store release.
    unlockAdsRemoved();
    setPlusPaywallVisible(false);
    if (__DEV__) {
      Alert.alert('BobaPop Plus active', `${planId} activated locally for testing.`);
    }
  }, [unlockAdsRemoved]);

  const handleRestorePurchases = useCallback(() => {
    if (adsRemoved) {
      Alert.alert('Restored', 'BobaPop Plus is already active.');
      return;
    }
    Alert.alert('Restore Purchases', 'Apple purchase restore will be connected after the subscription products are created.');
  }, [adsRemoved]);

  // ── Loading splash ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.fullScreen, styles.splash]}>
        <StatusBar hidden />
        <Image source={IMAGES.mascotHappy} style={styles.splashMascot} resizeMode="contain" />
        <Text style={styles.splashTitle}>BobaPop</Text>
        <Text style={styles.splashSub}>by CODEWERX LLC</Text>
      </View>
    );
  }

  // ── Build current screen content ──────────────────────────────────────────
  let screenContent: React.ReactNode = null;

  if (screen.name === 'select') {
    screenContent = (
      <>
        <StatusBar hidden translucent backgroundColor="transparent" />
        <LevelSelectScreen
          unlockedUpTo={unlockedUpTo}
          levelStars={levelStars}
          levelHighScores={levelHighScores}
          totalBobas={totalBobas}
          soundEnabled={soundEnabled}
          hapticsEnabled={hapticsEnabled}
          plusActive={adsRemoved}
          onSelectLevel={handleSelectLevel}
          onUpdateSettings={updateSettings}
          onOpenPlus={() => setPlusPaywallVisible(true)}
        />
      </>
    );
  } else if (screen.name === 'game') {
    screenContent = (
      <>
        <StatusBar hidden translucent backgroundColor="transparent" />
        <GameScreen
          levelIndex={screen.levelIndex}
          initialLives={screen.initialLives}
          seenOnboarding={seenOnboarding}
          onMarkOnboardingSeen={markOnboardingSeen}
          onLevelComplete={handleLevelComplete}
          onGameOver={handleGameOver}
          onBack={() => navigateTo({ name: 'select' })}
        />
      </>
    );
  } else if (screen.name === 'complete') {
    const { levelIndex, score, stars } = screen;
    const isLast = levelIndex >= LEVELS.length - 1;
    const isWorldBoss = LEVELS[levelIndex]?.isBoss ?? false;
    const worldTheme = WORLDS[LEVELS[levelIndex]?.worldIndex ?? 0];
    screenContent = (
      <>
        <StatusBar hidden translucent backgroundColor="transparent" />
        <LevelCompleteScreen
          score={score}
          stars={stars}
          levelNumber={levelIndex + 1}
          theme={worldTheme}
          isLast={isLast}
          isWorldBoss={isWorldBoss}
          onNext={() => startLevel(levelIndex + 1)}
          onReplay={() => startLevel(levelIndex)}
          onMenu={() => navigateTo({ name: 'select' })}
        />
      </>
    );
  } else if (screen.name === 'over') {
    const { levelIndex, score } = screen;
    const worldTheme = WORLDS[LEVELS[levelIndex]?.worldIndex ?? 0];
    const continuesUsed = runContinues[screen.runId] ?? 0;
    const continueOffer = getContinueOffer(levelIndex, continuesUsed, adsRemoved);
    screenContent = (
      <>
        <StatusBar hidden translucent backgroundColor="transparent" />
        <GameOverScreen
          score={score}
          levelNumber={levelIndex + 1}
          theme={worldTheme}
          adsRemoved={adsRemoved}
          continueOffer={continueOffer}
          adAvailable={adsRemoved || rewardedAdLoaded}
          onContinue={handleContinue}
          onRetry={handleRetryFromGameOver}
          onMenu={handleLevelSelectFromGameOver}
          onOpenPlus={() => setPlusPaywallVisible(true)}
        />
      </>
    );
  }

  return (
    <>
      <Animated.View style={[styles.fullScreen, { opacity: screenOpacity }]}>
        {screenContent}
      </Animated.View>

      {/* World intro modal overlays via RN Modal portal — renders above everything */}
      {worldIntro !== null && (
        <WorldIntroModal
          worldIndex={worldIntro.worldIndex}
          world={WORLDS[worldIntro.worldIndex]}
          onDone={handleWorldIntroDone}
        />
      )}

      <PlusPaywallModal
        visible={plusPaywallVisible}
        plusActive={adsRemoved}
        onClose={() => setPlusPaywallVisible(false)}
        onSelectPlan={handleSelectPlusPlan}
        onRestore={handleRestorePurchases}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#2A0F05',
  },
  splash: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashMascot: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  splashTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#F5C542',
    letterSpacing: 1,
  },
  splashSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 8,
  },
});
