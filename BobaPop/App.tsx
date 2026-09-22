import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import { OnboardingModal } from './src/components/OnboardingModal';
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
  configureAnalytics,
  flushAnalyticsQueue,
  trackEnergyAdResult,
  trackGameOverExit,
  trackLevelComplete,
  trackLevelFail,
  trackLevelStart,
  trackRewardedAdResult,
} from './src/analytics/gameAnalytics';
import { PlusPlanId } from './src/monetization/plus';
import { usePlusPurchases } from './src/hooks/usePlusPurchases';
import { GameState } from './src/game/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');

// ─── DEV ─────────────────────────────────────────────────────────────────────
const DEV_UNLOCK_ALL = false; // set to false before shipping
// ─────────────────────────────────────────────────────────────────────────────

const START_LOCK_MS = 650;

type Screen =
  | { name: 'select' }
  | { name: 'game'; levelIndex: number; runId: number; initialLives?: number; resumeState?: GameState }
  | { name: 'complete'; score: number; stars: number; levelIndex: number }
  | {
      name: 'over';
      score: number;
      levelIndex: number;
      runId: number;
      failedState: GameState;
      continueAvailableAt: number;
    };

/** Stars based on lives remaining — standard for casual arcade games */
function livesToStars(lives: number): number {
  if (lives >= 3) return 3;
  if (lives >= 2) return 2;
  return 1;
}

export default function App() {
  const levelIds = useMemo(() => LEVELS.map((level) => level.id), []);
  const [screen, setScreen] = useState<Screen>({ name: 'select' });
  const nextRunIdRef = useRef(1);
  const startLockedRef = useRef(false);
  const continuePendingRef = useRef(false);
  const energyAdPendingRef = useRef(false);
  const [runContinues, setRunContinues] = useState<Record<number, number>>({});
  const [plusPaywallVisible, setPlusPaywallVisible] = useState(false);
  const [
    worldIntro,
    setWorldIntro,
  ] = useState<{ worldIndex: number; levelIndex: number } | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(false);

  useEffect(() => {
    preloadSounds().catch(() => {});
    preloadMusic().catch(() => {});
  }, []);

  useEffect(() => {
    const endpoint = process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT;
    if (!endpoint) return;
    configureAnalytics(async (event) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }
    });
    flushAnalyticsQueue().catch(() => {});
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
    energy, maxEnergy, nextEnergyInMs,
    recordLevelComplete, markWorldSeen, markOnboardingSeen, updateSettings, setAdsRemovedEntitlement, isLevelUnlocked, spendEnergy, addEnergy,
  } = useSaveData(DEV_UNLOCK_ALL, levelIds);

  useEffect(() => {
    if (!loading && !seenOnboarding.app_intro) {
      setOnboardingVisible(true);
    }
  }, [loading, seenOnboarding.app_intro]);

  const { isLoaded: rewardedAdLoaded, status: rewardedAdStatus, showAd } = useRewardedAd();
  const setPlusEntitlement = useCallback((active: boolean) => {
    setAdsRemovedEntitlement(active);
  }, [setAdsRemovedEntitlement]);
  const {
    busyPlanId,
    storeMessage,
    storePlans,
    purchasePlan,
    restorePurchases,
  } = usePlusPurchases(setPlusEntitlement);

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

  const handleWatchEnergyAd = useCallback(() => {
    if (energy >= maxEnergy) {
      Alert.alert('Energy full', 'You are already stocked up.');
      return;
    }
    if (energyAdPendingRef.current) return;

    if (adsRemoved) {
      Alert.alert('Energy', 'Energy refills over time.');
      return;
    }

    if (!rewardedAdLoaded) {
      const message = rewardedAdStatus === 'loading'
        ? 'The ad is still loading. Try again in a moment.'
        : 'Rewarded ads are not available right now.';
      Alert.alert('Ad unavailable', message);
      return;
    }

    const energyBefore = energy;
    energyAdPendingRef.current = true;
    showAd((result) => {
      energyAdPendingRef.current = false;
      let energyAfter = energyBefore;
      if (result === 'watched') {
        const granted = addEnergy(1);
        energyAfter = granted ? Math.min(maxEnergy, energyBefore + 1) : energyBefore;
      }
      trackEnergyAdResult(result, energyBefore, energyAfter);
      if (result !== 'watched') return;
      Alert.alert('Energy added', `Energy ${energyAfter}/${maxEnergy}`);
    });
  }, [addEnergy, adsRemoved, energy, maxEnergy, rewardedAdLoaded, rewardedAdStatus, showAd]);

  const startLevel = useCallback((levelIndex: number, initialLives?: number, runId?: number, resumeState?: GameState) => {
    if (startLockedRef.current) return false;
    if (levelIndex < 0 || levelIndex >= LEVELS.length) return false;
    if (runId === undefined && !isLevelUnlocked(levelIndex)) return false;

    startLockedRef.current = true;
    const releaseStartLock = () => {
      setTimeout(() => {
        startLockedRef.current = false;
      }, START_LOCK_MS);
    };

    const resolvedRunId = runId ?? nextRunIdRef.current;
    if (runId === undefined) {
      if (!spendEnergy()) {
        startLockedRef.current = false;
        const minutes = Math.ceil(nextEnergyInMs / 60000);
        const message = minutes > 0
          ? `Next energy in ${minutes} minute${minutes === 1 ? '' : 's'}.`
          : 'Energy will be ready soon.';
        const buttons = !adsRemoved && rewardedAdLoaded
          ? [
              { text: 'Not now', style: 'cancel' as const },
              { text: 'Watch Ad', onPress: () => handleWatchEnergyAd() },
            ]
          : [{ text: 'OK' }];
        Alert.alert('Out of energy', message, buttons);
        return false;
      }
      nextRunIdRef.current += 1;
      setRunContinues((prev) => ({ ...prev, [resolvedRunId]: 0 }));
    }
    trackLevelStart(levelIndex, resolvedRunId);
    navigateTo({ name: 'game', levelIndex, runId: resolvedRunId, initialLives, resumeState });
    releaseStartLock();
    return true;
  }, [adsRemoved, handleWatchEnergyAd, isLevelUnlocked, navigateTo, nextEnergyInMs, rewardedAdLoaded, spendEnergy]);

  const handleSelectLevel = useCallback((index: number) => {
    if (index < 0 || index >= LEVELS.length || !isLevelUnlocked(index)) return;
    const worldIndex = LEVELS[index]?.worldIndex ?? 0;
    if (!seenWorlds.includes(worldIndex)) {
      // Show world intro before entering the first level of a new world
      setWorldIntro({ worldIndex, levelIndex: index });
    } else {
      startLevel(index);
    }
  }, [isLevelUnlocked, seenWorlds, startLevel]);

  const handleWorldIntroDone = useCallback(() => {
    if (!worldIntro) return;
    markWorldSeen(worldIntro.worldIndex);
    const levelIndex = worldIntro.levelIndex;
    setWorldIntro(null);
    startLevel(levelIndex);
  }, [worldIntro, markWorldSeen, startLevel]);

  const handleOnboardingDone = useCallback(() => {
    markOnboardingSeen('app_intro');
    setOnboardingVisible(false);
  }, [markOnboardingSeen]);

  const handleLevelComplete = useCallback(
    (score: number, bricksPopped: number, lives: number) => {
      if (screen.name !== 'game') return;
      const idx = screen.levelIndex;
      const earned = livesToStars(lives);
      trackLevelComplete(idx, score, earned, bricksPopped, lives);
      recordLevelComplete(idx, earned, score, bricksPopped);
      navigateTo({ name: 'complete', score, stars: earned, levelIndex: idx });
    },
    [screen, recordLevelComplete, navigateTo],
  );

  const handleGameOver = useCallback(
    (score: number, failedState: GameState) => {
      if (screen.name !== 'game') return;
      const continuesUsed = runContinues[screen.runId] ?? 0;
      const offer = getContinueOffer(screen.levelIndex, continuesUsed, adsRemoved);
      const continueAvailableAt = Date.now() + offer.delaySeconds * 1000;
      trackLevelFail(screen.levelIndex, score, continuesUsed);
      navigateTo({
        name: 'over',
        score,
        levelIndex: screen.levelIndex,
        runId: screen.runId,
        failedState,
        continueAvailableAt,
      });
    },
    [adsRemoved, screen, navigateTo, runContinues],
  );

  const handleContinue = useCallback(() => {
    if (screen.name !== 'over') return;
    const { levelIndex, runId } = screen;
    const continuesUsed = runContinues[runId] ?? 0;
    const offer = getContinueOffer(levelIndex, continuesUsed, adsRemoved);
    if (!offer.canShow) return;
    if (!adsRemoved && Date.now() < screen.continueAvailableAt) return;
    if (continuePendingRef.current) return;

    continuePendingRef.current = true;
    trackContinueAccepted(levelIndex, offer.continueNumber, offer.rewardLives);

    if (offer.reason === 'ads_removed') {
      if (startLevel(levelIndex, offer.rewardLives, runId, screen.failedState)) {
        setRunContinues((prev) => ({ ...prev, [runId]: continuesUsed + 1 }));
      }
      continuePendingRef.current = false;
      return;
    }

    showAd((result) => {
      trackRewardedAdResult(levelIndex, offer.continueNumber, result);
      continuePendingRef.current = false;
      if (result !== 'watched') return;
      if (startLevel(levelIndex, offer.rewardLives, runId, screen.failedState)) {
        setRunContinues((prev) => ({ ...prev, [runId]: continuesUsed + 1 }));
      }
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
    purchasePlan(planId);
  }, [purchasePlan]);

  const handleRestorePurchases = useCallback(() => {
    if (adsRemoved) {
      Alert.alert('Restored', 'BobaPop Plus is already active.');
      return;
    }
    restorePurchases();
  }, [adsRemoved, restorePurchases]);

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
          isLevelUnlocked={isLevelUnlocked}
          levelStars={levelStars}
          levelHighScores={levelHighScores}
          totalBobas={totalBobas}
          soundEnabled={soundEnabled}
          hapticsEnabled={hapticsEnabled}
          plusActive={adsRemoved}
          energy={energy}
          maxEnergy={maxEnergy}
          nextEnergyInMs={nextEnergyInMs}
          energyAdReady={!adsRemoved && rewardedAdLoaded}
          energyAdLoading={!adsRemoved && rewardedAdStatus === 'loading'}
          onSelectLevel={handleSelectLevel}
          onWatchEnergyAd={handleWatchEnergyAd}
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
          resumeState={screen.resumeState}
          energy={energy}
          maxEnergy={maxEnergy}
          nextEnergyInMs={nextEnergyInMs}
          seenOnboarding={seenOnboarding}
          onMarkOnboardingSeen={markOnboardingSeen}
          onLevelComplete={handleLevelComplete}
          onGameOver={handleGameOver}
          onBack={() => navigateTo({ name: 'select' })}
          onRestart={() => startLevel(screen.levelIndex)}
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
          onNext={() => handleSelectLevel(levelIndex + 1)}
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
          adUnavailable={!adsRemoved && rewardedAdStatus === 'unavailable'}
          energy={energy}
          maxEnergy={maxEnergy}
          nextEnergyInMs={nextEnergyInMs}
          onContinue={handleContinue}
          onWatchEnergyAd={handleWatchEnergyAd}
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
        plans={storePlans}
        busyPlanId={busyPlanId}
        storeMessage={storeMessage}
        onClose={() => setPlusPaywallVisible(false)}
        onSelectPlan={handleSelectPlusPlan}
        onRestore={handleRestorePurchases}
      />

      <OnboardingModal
        visible={onboardingVisible}
        onDone={handleOnboardingDone}
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
