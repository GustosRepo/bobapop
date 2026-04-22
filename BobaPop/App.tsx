import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, StatusBar, Text, Image, Animated } from 'react-native';
import { GameScreen } from './src/screens/GameScreen';
import { LevelSelectScreen } from './src/screens/LevelSelectScreen';
import { LevelCompleteScreen } from './src/screens/LevelCompleteScreen';
import { GameOverScreen } from './src/screens/GameOverScreen';
import { WORLDS } from './src/constants/themes';
import { LEVELS } from './src/game/levels';
import { useSaveData } from './src/hooks/useSaveData';
import { IMAGES } from './src/assets/images';
import { WorldIntroModal } from './src/components/WorldIntroModal';
import { preloadSounds } from './src/hooks/useSound';
import { setSoundEnabled, setHapticsEnabled } from './src/hooks/useSound';
import { preloadMusic, playMusic, setMusicEnabled } from './src/hooks/useMusic';
import { AppState, AppStateStatus } from 'react-native';
import { pauseMusic, resumeMusic } from './src/hooks/useMusic';
import { useRewardedAd } from './src/hooks/useRewardedAd';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');

// ─── DEV ─────────────────────────────────────────────────────────────────────
const DEV_UNLOCK_ALL = true; // set to false before shipping
// ─────────────────────────────────────────────────────────────────────────────

type Screen =
  | { name: 'select' }
  | { name: 'game'; levelIndex: number; initialLives?: number }
  | { name: 'complete'; score: number; stars: number; levelIndex: number }
  | { name: 'over'; score: number; levelIndex: number };

/** Stars based on lives remaining — standard for casual arcade games */
function livesToStars(lives: number): number {
  if (lives >= 3) return 3;
  if (lives >= 2) return 2;
  return 1;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'select' });
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
    seenWorlds, soundEnabled, hapticsEnabled, adsRemoved,
    recordLevelComplete, markWorldSeen, updateSettings, unlockAdsRemoved,
  } = useSaveData(DEV_UNLOCK_ALL, LEVELS.length);

  const { showAd } = useRewardedAd();

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

  // ── Screen fade transition ──────────────────────────────────────────────────────
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const navigateTo = useCallback((newScreen: Screen) => {
    Animated.timing(screenOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setScreen(newScreen);
      Animated.timing(screenOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }, [screenOpacity]);

  const handleSelectLevel = useCallback((index: number) => {
    const worldIndex = LEVELS[index]?.worldIndex ?? 0;
    if (!seenWorlds.includes(worldIndex)) {
      // Show world intro before entering the first level of a new world
      setWorldIntro({ worldIndex, levelIndex: index });
    } else {
      navigateTo({ name: 'game', levelIndex: index });
    }
  }, [seenWorlds, navigateTo]);

  const handleWorldIntroDone = useCallback(() => {
    if (!worldIntro) return;
    markWorldSeen(worldIntro.worldIndex);
    const levelIndex = worldIntro.levelIndex;
    setWorldIntro(null);
    navigateTo({ name: 'game', levelIndex });
  }, [worldIntro, markWorldSeen, navigateTo]);

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
      navigateTo({ name: 'over', score, levelIndex: screen.levelIndex });
    },
    [screen, navigateTo],
  );

  const handleContinue = useCallback(() => {
    if (screen.name !== 'over') return;
    const levelIndex = screen.levelIndex;
    showAd(() => {
      navigateTo({ name: 'game', levelIndex, initialLives: 2 });
    });
  }, [screen, showAd, navigateTo]);

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
          onSelectLevel={handleSelectLevel}
          onUpdateSettings={updateSettings}
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
          onNext={() => navigateTo({ name: 'game', levelIndex: levelIndex + 1 })}
          onReplay={() => navigateTo({ name: 'game', levelIndex })}
          onMenu={() => navigateTo({ name: 'select' })}
        />
      </>
    );
  } else if (screen.name === 'over') {
    const { levelIndex, score } = screen;
    const worldTheme = WORLDS[LEVELS[levelIndex]?.worldIndex ?? 0];
    screenContent = (
      <>
        <StatusBar hidden translucent backgroundColor="transparent" />
        <GameOverScreen
          score={score}
          levelNumber={levelIndex + 1}
          theme={worldTheme}
          adsRemoved={adsRemoved}
          onContinue={handleContinue}
          onRetry={() => navigateTo({ name: 'game', levelIndex })}
          onMenu={() => navigateTo({ name: 'select' })}
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
