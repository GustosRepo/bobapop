import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Text, Image, Animated, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from './src/hooks/useReducedMotion';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
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
import { CompletionReward, ENERGY_AD_REWARD } from './src/monetization/economy';
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


// ─── DEV ─────────────────────────────────────────────────────────────────────
const DEV_UNLOCK_ALL = false; // set to false before shipping
// ─────────────────────────────────────────────────────────────────────────────

const START_LOCK_MS = 650;

type Screen =
  | { name: 'select' }
  | { name: 'game'; levelIndex: number; runId: number; initialLives?: number; resumeState?: GameState }
  | ({ name: 'complete'; score: number; stars: number; levelIndex: number } & CompletionReward)
  | {
      name: 'over';
      score: number;
      levelIndex: number;
      runId: number;
      failedState: GameState;
    };

/** Stars based on lives remaining — standard for casual arcade games */
function livesToStars(lives: number): number {
  if (lives >= 3) return 3;
  if (lives >= 2) return 2;
  return 1;
}

export default function App() {
  return <SafeAreaProvider><AppErrorBoundary><BobaPop /></AppErrorBoundary></SafeAreaProvider>;
}

function BobaPop() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const levelIds = useMemo(() => LEVELS.map((level) => level.id), []);
  const [screen, setScreen] = useState<Screen>({ name: 'select' });
  const nextRunIdRef = useRef(1);
  const runEndingRef = useRef(false);
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
    if (!endpoint || (!__DEV__ && !endpoint.startsWith('https://'))) return;
    configureAnalytics(async (event) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }
      } finally { clearTimeout(timer); }
    });
    flushAnalyticsQueue().catch(() => {});
  }, []);

  // ── App background / foreground — pause music when backgrounded ────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') { resumeMusic(); flushAnalyticsQueue().catch(() => {}); }
      else pauseMusic();
    });
    return () => sub.remove();
  }, []);

  const {
    loading, ready: saveReady, saveError, retrySave, unlockedUpTo, levelStars, levelHighScores, totalBobas, selectedBadgeId, selectBadge,
    seenWorlds, soundEnabled, hapticsEnabled, adsRemoved, seenOnboarding,
    energy, maxEnergy, nextEnergyInMs,
    recordLevelComplete, markWorldSeen, markOnboardingSeen, updateSettings, setAdsRemovedEntitlement, isLevelUnlocked, spendEnergy, addEnergy,
  } = useSaveData(DEV_UNLOCK_ALL, levelIds);

  useEffect(() => {
    if (saveReady && !loading && !seenOnboarding.app_intro) {
      setOnboardingVisible(true);
    }
  }, [loading, saveReady, seenOnboarding.app_intro]);

  const { isLoaded: rewardedAdLoaded, status: rewardedAdStatus, showAd, privacyOptionsRequired, openPrivacyOptions } = useRewardedAd(saveReady && !loading && seenOnboarding.app_intro && !adsRemoved);
  const setPlusEntitlement = useCallback((active: boolean, expiresAt?: number | null) => {
    setAdsRemovedEntitlement(active, expiresAt);
  }, [setAdsRemovedEntitlement]);
  const {
    busyPlanId,
    restoring,
    connected: storeConnected,
    storeMessage,
    storePlans,
    purchasePlan,
    restorePurchases,
    reloadProducts,
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
    if (reducedMotion) { setScreen(newScreen); return; }
    Animated.timing(screenOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setScreen(newScreen);
      Animated.timing(screenOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }, [screenOpacity, reducedMotion]);

  const handleWatchEnergyAd = useCallback(() => {
    if (energy >= maxEnergy) {
      Alert.alert('Energy full', 'You are already stocked up.');
      return;
    }
    if (energyAdPendingRef.current) return;

    if (adsRemoved) return;

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
      if (result !== 'watched') { trackEnergyAdResult(result, energyBefore, energyBefore); return; }
      const grant = addEnergy(ENERGY_AD_REWARD);
      trackEnergyAdResult(result, grant.energyBefore, grant.energyAfter);
      Alert.alert(grant.added > 0 ? `+${grant.added} Energy` : 'Energy full', `Energy ${grant.energyAfter}/${maxEnergy}`);
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
              { text: `Watch Ad · +${ENERGY_AD_REWARD} Energy`, onPress: () => handleWatchEnergyAd() },
            ]
          : [{ text: 'OK' }];
        Alert.alert('Out of energy', message, buttons);
        return false;
      }
      nextRunIdRef.current += 1;
      setRunContinues({ [resolvedRunId]: 0 });
    }
    runEndingRef.current = false;
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
      if (screen.name !== 'game' || runEndingRef.current) return;
      runEndingRef.current = true;
      const idx = screen.levelIndex;
      const earned = livesToStars(lives);
      trackLevelComplete(idx, score, earned, bricksPopped, lives);
      const reward = recordLevelComplete(idx, earned, score, bricksPopped);
      navigateTo({ name: 'complete', score, stars: earned, levelIndex: idx, ...reward });
    },
    [screen, recordLevelComplete, navigateTo],
  );

  const handleGameOver = useCallback(
    (score: number, failedState: GameState) => {
      if (screen.name !== 'game' || runEndingRef.current) return;
      runEndingRef.current = true;
      const continuesUsed = runContinues[screen.runId] ?? 0;
      trackLevelFail(screen.levelIndex, score, continuesUsed);
      navigateTo({
        name: 'over',
        score,
        levelIndex: screen.levelIndex,
        runId: screen.runId,
        failedState,
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
    restorePurchases();
  }, [restorePurchases]);

  // ── Loading splash ──────────────────────────────────────────────────────
  if (loading || !saveReady) {
    return (
      <View style={[styles.fullScreen, styles.splash]}>
        <StatusBar hidden />
        <Image source={IMAGES.mascotHappy} style={styles.splashMascot} resizeMode="contain" />
        <Text style={styles.splashTitle}>BobaPop</Text>
        <Text style={styles.splashSub}>by CODEWERX LLC</Text>
        {saveError && <View style={{ padding: 24 }} accessibilityLiveRegion="assertive">
          <Text style={styles.saveNoticeText}>{saveError}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={retrySave} style={styles.retrySave}><Text style={styles.saveNoticeText}>Retry loading progress</Text></TouchableOpacity>
        </View>}
      </View>
    );
  }

  // ── Build current screen content ──────────────────────────────────────────
  let screenContent: React.ReactNode = null;

  if (screen.name === 'select') {
    screenContent = (
      <>
        <StatusBar hidden />
        <LevelSelectScreen
          unlockedUpTo={unlockedUpTo}
          isLevelUnlocked={isLevelUnlocked}
          levelStars={levelStars}
          levelHighScores={levelHighScores}
          totalBobas={totalBobas}
          selectedBadgeId={selectedBadgeId}
          onSelectBadge={selectBadge}
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
          privacyOptionsRequired={privacyOptionsRequired}
          onOpenPrivacy={openPrivacyOptions}
          onOpenPlus={() => setPlusPaywallVisible(true)}
        />
      </>
    );
  } else if (screen.name === 'game') {
    screenContent = (
      <>
        <StatusBar hidden />
        <GameScreen
          key={screen.runId}
          levelIndex={screen.levelIndex}
          initialLives={screen.initialLives}
          resumeState={screen.resumeState}
          energy={energy}
          unlimitedEnergy={adsRemoved}
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
        <StatusBar hidden />
        <LevelCompleteScreen
          score={score}
          firstClear={screen.firstClear}
          badgeUnlocks={screen.badgeUnlocks}
          energyRefund={screen.energyRefund}
          unlimitedEnergy={adsRemoved}
          stars={stars}
          levelNumber={levelIndex + 1}
          theme={worldTheme}
          isLast={isLast}
          isWorldBoss={isWorldBoss}
          chapter={LEVELS[levelIndex].chapter ?? 1}
          isChapterComplete={!isLast && (LEVELS[levelIndex + 1].chapter ?? 1) !== (LEVELS[levelIndex].chapter ?? 1)}
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
        <StatusBar hidden />
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

      {saveError && (
        <View style={[styles.saveNotice, { top: insets.top + 8 }]} accessibilityLiveRegion="assertive">
          <Text style={styles.saveNoticeText}>{saveError}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry saving or loading progress" onPress={retrySave} style={styles.retrySave}>
            <Text style={styles.saveNoticeText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

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
        restoring={restoring}
        storeConnected={storeConnected}
        storeMessage={storeMessage}
        onClose={() => setPlusPaywallVisible(false)}
        onSelectPlan={handleSelectPlusPlan}
        onRestore={handleRestorePurchases}
        onReloadProducts={reloadProducts}
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
    right: 0,
    bottom: 0,
    backgroundColor: '#2A0F05',
  },
  saveNotice: { position: 'absolute', left: 12, right: 12, backgroundColor: '#54280C', padding: 12, borderRadius: 12, zIndex: 50 },
  saveNoticeText: { color: '#FFF8EF', fontSize: 15 },
  retrySave: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
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
