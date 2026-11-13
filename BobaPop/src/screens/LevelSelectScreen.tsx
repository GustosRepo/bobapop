import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Image,
  ImageBackground,
  Animated,
  TouchableOpacity,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { WORLDS } from '../constants/themes';
import { IMAGES } from '../assets/images';
import { ENERGY_AD_REWARD } from '../monetization/economy';
import { BadgeRewards } from '../components/BadgeRewards';
import { BadgeStyleId, getBadgeStyle } from '../game/badgeRewards';
import { calculatePlayerLevel } from '../game/progression';
import { LEVELS } from '../game/levels';
import { styles } from './LevelSelectScreen.styles';
import { LevelWorldSection } from '../components/LevelWorldSection';
import { FloatingBobas } from '../components/FloatingBobas';
import { SettingsModal } from '../components/SettingsModal';
import { useSound } from '../hooks/useSound';

interface Props {
  unlockedUpTo: number;
  isLevelUnlocked: (index: number) => boolean;
  levelStars: Record<number, number>;
  levelHighScores: Record<number, number>;
  totalBobas: number;
  selectedBadgeId: BadgeStyleId;
  onSelectBadge: (id: BadgeStyleId) => void;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  plusActive: boolean;
  privacyOptionsRequired: boolean;
  onOpenPrivacy: () => void;
  energy: number;
  maxEnergy: number;
  nextEnergyInMs: number;
  energyAdReady: boolean;
  energyAdLoading: boolean;
  onSelectLevel: (index: number) => void;
  onWatchEnergyAd: () => void;
  onUpdateSettings: (sound: boolean, haptics: boolean) => void;
  onOpenPlus: () => void;
}


export const LevelSelectScreen: React.FC<Props> = ({
  unlockedUpTo,
  isLevelUnlocked,
  levelStars,
  levelHighScores,
  totalBobas,
  selectedBadgeId,
  onSelectBadge,
  soundEnabled,
  hapticsEnabled,
  plusActive,
  privacyOptionsRequired,
  onOpenPrivacy,
  energy,
  maxEnergy,
  nextEnergyInMs,
  energyAdReady,
  energyAdLoading,
  onSelectLevel,
  onWatchEnergyAd,
  onUpdateSettings,
  onOpenPlus,
}) => {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { playSound } = useSound();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const mascotAnim = useRef(new Animated.Value(0)).current;
  const starShimmerAnim = useRef(new Animated.Value(0)).current;
  const worldAnims = useRef(WORLDS.map(() => new Animated.Value(0))).current;

  // Calculate player level
  const totalStars = useMemo(() => {
    return Object.values(levelStars).reduce((sum, stars) => sum + stars, 0);
  }, [levelStars]);
  const playerLevel = calculatePlayerLevel(totalStars);
  const badgeStyle = getBadgeStyle(selectedBadgeId, totalStars, totalBobas);
  const completedLevels = useMemo(() => {
    return Object.values(levelStars).filter((stars) => stars > 0).length;
  }, [levelStars]);
  const perfectLevels = useMemo(() => {
    return Object.values(levelStars).filter((stars) => stars >= 3).length;
  }, [levelStars]);
  const bestScore = useMemo(() => {
    return Object.values(levelHighScores).reduce((best, score) => Math.max(best, score), 0);
  }, [levelHighScores]);
  const nextEnergyMinutes = Math.ceil(nextEnergyInMs / 60000);
  const energyAdReward = Math.min(ENERGY_AD_REWARD, Math.max(0, maxEnergy - energy));
  const canWatchEnergyAd = !plusActive && energy < maxEnergy && energyAdReady;
  const energySubText = plusActive ? 'Plus · Unlimited' : energy >= maxEnergy
    ? 'Full'
    : energyAdReady
    ? `Watch Ad +${energyAdReward}`
    : energyAdLoading
    ? 'Ad loading'
    : `${nextEnergyMinutes}m`;

  useEffect(() => {
    if (reducedMotion) { mascotAnim.setValue(1); worldAnims.forEach((anim) => anim.setValue(1)); return; }
    // Mascot entrance
    Animated.spring(mascotAnim, {
      toValue: 1,
      speed: 5,
      bounciness: 12,
      useNativeDriver: true,
    }).start();

    // Stagger world sections
    Animated.stagger(
      150,
      worldAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          speed: 6,
          bounciness: 8,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) { starShimmerAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.timing(starShimmerAnim, {
        toValue: 1,
        duration: 2200,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [starShimmerAnim, reducedMotion]);

  const mascotScale = mascotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });
  const starShimmerRotate = starShimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const starShimmerScale = starShimmerAnim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0.94, 1.08, 0.94],
  });
  const starShimmerOpacity = starShimmerAnim.interpolate({
    inputRange: [0, 0.2, 0.65, 1],
    outputRange: [0.25, 0.9, 0.55, 0.25],
  });

  // Find the next level to play
  const nextLevelIndex = Math.min(unlockedUpTo, LEVELS.length - 1);
  const nextLevel = LEVELS[nextLevelIndex];
  const nextWorld = WORLDS[nextLevel.worldIndex];
  const levelIndexesByWorld = useMemo(() => {
    return WORLDS.map((_, worldIndex) => (
      LEVELS.reduce<number[]>((indexes, level, levelIndex) => {
        if (level.worldIndex === worldIndex) indexes.push(levelIndex);
        return indexes;
      }, [])
    ));
  }, []);

  return (
    <ImageBackground
      source={IMAGES.backgrounds[0]}
      style={styles.root}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(232,212,184,0.56)', 'rgba(212,184,150,0.64)', 'rgba(201,169,118,0.60)']}
        style={StyleSheet.absoluteFill}
      />
      <FloatingBobas />
      <StatusBar hidden />

      {/* ── Top Bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {/* Player Level Badge */}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="View player statistics" style={styles.playerBadge} activeOpacity={0.8} onPress={() => {
          if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          playSound('level_tap');
          setStatsVisible(true);
        }}>
          <LinearGradient
            colors={badgeStyle.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image source={IMAGES.effectBurst} style={styles.badgeGlow} resizeMode="cover" />
          <Text style={[styles.badgeLevel, { color: badgeStyle.foreground }]}>{playerLevel.level}</Text>
        </TouchableOpacity>

        {/* Energy */}
        <TouchableOpacity accessibilityRole="button"
          accessibilityLabel={plusActive ? 'Unlimited Energy with Plus' : canWatchEnergyAd ? `Watch Ad · +${energyAdReward} Energy` : `Energy ${energy} of ${maxEnergy}`}
          style={[styles.energyCounter, canWatchEnergyAd && styles.energyCounterReady]}
          activeOpacity={canWatchEnergyAd ? 0.82 : 1}
          disabled={!canWatchEnergyAd}
          onPress={() => {
            if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            playSound('level_tap');
            onWatchEnergyAd();
          }}
        >
          <View style={styles.energyGlyph}>
            <Text style={styles.energyGlyphText}>E</Text>
          </View>
          <View>
            <Text style={styles.energyText}>{plusActive ? 'Energy ∞' : `Energy ${energy}/${maxEnergy}`}</Text>
            <Text style={styles.energySub}>
              {energySubText}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Boba Counter */}
        <View style={styles.bobaCounter}>
          <Text style={styles.bobaIconText}>🧋</Text>
          <Text style={styles.bobaText}>{totalBobas.toLocaleString()}</Text>
        </View>

        {/* Settings Button */}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open settings" style={styles.settingsBtn} onPress={() => {
          if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          playSound('level_tap');
          setSettingsVisible(true);
        }}>
          <Image source={IMAGES.settingsBtn} style={styles.settingsIcon} resizeMode="contain" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Big Mascot ── */}
        <Animated.View style={[styles.mascotContainer, { transform: [{ scale: mascotScale }] }]}>
          <Image source={IMAGES.mascotHappy} style={styles.mascot} resizeMode="contain" />
        </Animated.View>

        {/* ── Title ── */}
        <Text style={styles.title}>BobaPop</Text>
        <Text style={styles.subtitle}>Pop, Slurp, Repeat!</Text>

        {/* ── Continue Button ── */}
        <TouchableOpacity accessibilityRole="button"
          style={[styles.continueBtn, { backgroundColor: nextWorld.accentColor }]}
          onPress={() => {
            if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            playSound('level_tap');
            onSelectLevel(nextLevelIndex);
          }}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[nextWorld.accentColor, nextWorld.background[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.continueBtnText}>
            {completedLevels === LEVELS.length ? 'REPLAY' : nextLevelIndex === 0 ? 'START' : 'CONTINUE'}
          </Text>
          <Text style={styles.continueBtnSub}>
            {plusActive ? `Level ${nextLevelIndex + 1} · Unlimited Energy` : energy > 0
              ? `Level ${nextLevelIndex + 1} - Energy ${energy}/${maxEnergy}`
              : `Next energy in ${nextEnergyMinutes}m`}
          </Text>
        </TouchableOpacity>

        {completedLevels === LEVELS.length && (
          <Text style={styles.subtitle} accessibilityLiveRegion="polite">
            {perfectLevels === LEVELS.length ? 'Every level perfected! Replay to beat your best scores.' : `${LEVELS.length - perfectLevels} levels left to earn three stars. Choose one below.`}
          </Text>
        )}

        {/* ── World Sections ── */}
        {WORLDS.map((world, worldIndex) => (
          <LevelWorldSection key={worldIndex} world={world} worldIndex={worldIndex}
            indexes={levelIndexesByWorld[worldIndex]} unlockedUpTo={unlockedUpTo}
            isLevelUnlocked={isLevelUnlocked} levelStars={levelStars} worldAnim={worldAnims[worldIndex]}
            nextLevelIndex={nextLevelIndex} hapticsEnabled={hapticsEnabled}
            playSound={playSound} onSelectLevel={onSelectLevel}
            shimmer={{ opacity: starShimmerOpacity, rotate: starShimmerRotate, scale: starShimmerScale }} />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        soundEnabled={soundEnabled}
        hapticsEnabled={hapticsEnabled}
        plusActive={plusActive}
        privacyOptionsRequired={privacyOptionsRequired}
        onOpenPrivacy={onOpenPrivacy}
        onClose={() => setSettingsVisible(false)}
        onUpdateSettings={onUpdateSettings}
        onOpenPlus={() => {
          setSettingsVisible(false);
          onOpenPlus();
        }}
      />

      <Modal visible={statsVisible} transparent animationType="fade" onRequestClose={() => setStatsVisible(false)}>
        <View style={styles.statsBackdrop}>
          <TouchableOpacity accessible={false} style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setStatsVisible(false)} />
          <View style={styles.statsCard}>
            <LinearGradient
              colors={['#FFF8EC', '#F5D39A']}
              style={StyleSheet.absoluteFill}
            />
            <ScrollView style={{ width: '100%' }} contentContainerStyle={styles.statsContent}>
            <Image source={IMAGES.mascotExcited} style={styles.statsMascot} resizeMode="contain" />
            <Text style={styles.statsTitle}>{playerLevel.title}</Text>
            <Text style={styles.statsLevel}>Level {playerLevel.level}</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{totalStars}/{LEVELS.length * 3}</Text>
                <Text style={styles.statLabel}>Stars</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{completedLevels}/{LEVELS.length}</Text>
                <Text style={styles.statLabel}>Cleared</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{perfectLevels}</Text>
                <Text style={styles.statLabel}>Perfects</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{bestScore.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Best Score</Text>
              </View>
            </View>

            <BadgeRewards stars={totalStars} bobas={totalBobas} selectedId={badgeStyle.id} onSelect={onSelectBadge} />

            <View style={styles.statsFooter}>
              <Text style={styles.statsFooterText}>
                {totalBobas.toLocaleString()} bobas banked from clears
              </Text>
              <Text style={styles.statsFooterText}>
                {plusActive ? 'Unlimited Energy' : `Energy ${energy}/${maxEnergy}`}
              </Text>
            </View>

            <TouchableOpacity accessibilityRole="button"
              style={styles.statsDoneBtn}
              onPress={() => setStatsVisible(false)}
              activeOpacity={0.86}
            >
              <Text style={styles.statsDoneText}>Done</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
};
