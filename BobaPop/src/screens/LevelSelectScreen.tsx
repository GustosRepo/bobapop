import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Dimensions,
  Image,
  ImageBackground,
  Animated,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { WORLDS } from '../constants/themes';
import { IMAGES } from '../assets/images';
import { LEVELS } from '../game/levels';
import { FloatingBobas } from '../components/FloatingBobas';
import { SettingsModal } from '../components/SettingsModal';
import { useSound } from '../hooks/useSound';

interface Props {
  unlockedUpTo: number;
  isLevelUnlocked: (index: number) => boolean;
  levelStars: Record<number, number>;
  levelHighScores: Record<number, number>;
  totalBobas: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  plusActive: boolean;
  energyLives: number;
  maxEnergyLives: number;
  nextEnergyInMs: number;
  onSelectLevel: (index: number) => void;
  onUpdateSettings: (sound: boolean, haptics: boolean) => void;
  onOpenPlus: () => void;
}

const { width: SW, height: SH } = Dimensions.get('window');

// Player level calculation based on total stars
function calculatePlayerLevel(totalStars: number): { level: number; title: string } {
  if (totalStars >= 60) return { level: 10, title: 'Boba Master' };
  if (totalStars >= 54) return { level: 9, title: 'Boba Legend' };
  if (totalStars >= 48) return { level: 8, title: 'Boba Expert' };
  if (totalStars >= 42) return { level: 7, title: 'Boba Pro' };
  if (totalStars >= 36) return { level: 6, title: 'Boba Ace' };
  if (totalStars >= 30) return { level: 5, title: 'Boba Adept' };
  if (totalStars >= 24) return { level: 4, title: 'Boba Slurper' };
  if (totalStars >= 18) return { level: 3, title: 'Boba Fan' };
  if (totalStars >= 12) return { level: 2, title: 'Boba Novice' };
  if (totalStars >= 6) return { level: 1, title: 'Boba Beginner' };
  return { level: 0, title: 'New Popper' };
}

export const LevelSelectScreen: React.FC<Props> = ({
  unlockedUpTo,
  isLevelUnlocked,
  levelStars,
  levelHighScores,
  totalBobas,
  soundEnabled,
  hapticsEnabled,
  plusActive,
  energyLives,
  maxEnergyLives,
  nextEnergyInMs,
  onSelectLevel,
  onUpdateSettings,
  onOpenPlus,
}) => {
  const { playSound } = useSound();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const mascotAnim = useRef(new Animated.Value(0)).current;
  const starShimmerAnim = useRef(new Animated.Value(0)).current;
  const worldAnims = useRef(WORLDS.map(() => new Animated.Value(0))).current;

  // Calculate player level
  const totalStars = useMemo(() => {
    return Object.values(levelStars).reduce((sum, stars) => sum + stars, 0);
  }, [levelStars]);
  const playerLevel = calculatePlayerLevel(totalStars);
  const nextEnergyMinutes = Math.ceil(nextEnergyInMs / 60000);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(starShimmerAnim, {
        toValue: 1,
        duration: 2200,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [starShimmerAnim]);

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

  // Determine which worlds are unlocked
  const unlockedWorlds = useMemo(() => {
    const worlds = new Set<number>();
    for (let i = 0; i < LEVELS.length; i++) {
      if (!isLevelUnlocked(i)) continue;
      worlds.add(LEVELS[i].worldIndex);
    }
    return worlds;
  }, [isLevelUnlocked]);

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
      <View style={styles.topBar}>
        {/* Player Level Badge */}
        <TouchableOpacity style={styles.playerBadge} activeOpacity={0.8} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // TODO: show player stats modal
        }}>
          <LinearGradient
            colors={['#FFD700', '#FF8C00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image source={IMAGES.effectBurst} style={styles.badgeGlow} resizeMode="cover" />
          <Text style={styles.badgeLevel}>{playerLevel.level}</Text>
        </TouchableOpacity>

        {/* Energy Lives */}
        <View style={styles.energyCounter}>
          <Image source={IMAGES.lifeIcon} style={styles.energyIcon} resizeMode="contain" />
          <View>
            <Text style={styles.energyText}>{energyLives}/{maxEnergyLives}</Text>
            <Text style={styles.energySub}>
              {nextEnergyInMs > 0 ? `${nextEnergyMinutes}m` : 'Full'}
            </Text>
          </View>
        </View>

        {/* Boba Counter */}
        <View style={styles.bobaCounter}>
          <Text style={styles.bobaIconText}>🧋</Text>
          <Text style={styles.bobaText}>{totalBobas.toLocaleString()}</Text>
        </View>

        {/* Settings Button */}
        <TouchableOpacity style={styles.settingsBtn} onPress={() => {
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
        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: nextWorld.accentColor }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
            {nextLevelIndex === 0 ? 'START' : 'CONTINUE'}
          </Text>
          <Text style={styles.continueBtnSub}>
            {energyLives > 0
              ? `Level ${nextLevelIndex + 1} - Lives ${energyLives}/${maxEnergyLives}`
              : `Next life in ${nextEnergyMinutes}m`}
          </Text>
        </TouchableOpacity>

        {/* ── World Sections ── */}
        {WORLDS.map((world, worldIndex) => {
          const levelIndexes = levelIndexesByWorld[worldIndex] ?? [];
          const levelsInWorld = levelIndexes.length;
          const completedCount = levelIndexes
            .filter((idx) => (levelStars[idx] ?? 0) > 0).length;
          const worldProgress = levelsInWorld > 0 ? (completedCount / levelsInWorld) * 100 : 0;
          
          const isWorldUnlocked = unlockedWorlds.has(worldIndex);
          const worldAnim = worldAnims[worldIndex];

          // Calculate unlock requirement for locked worlds
          const firstLevelIndex = levelIndexes[0] ?? 0;
          const unlockRequirement = worldIndex > 0 ? firstLevelIndex : 0;

          const animStyle = {
            opacity: worldAnim,
            transform: [
              {
                translateY: worldAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
              {
                scale: worldAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          };

          // Show locked world preview card
          if (!isWorldUnlocked) {
            return (
              <Animated.View key={worldIndex} style={[styles.worldSection, animStyle]}>
                <TouchableOpacity
                  style={styles.lockedWorldCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  }}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.85)']}
                    style={StyleSheet.absoluteFill}
                  />
                  
                  {/* Background preview with world colors */}
                  <LinearGradient
                    colors={[world.background[0], world.background[1], world.accentColor]}
                    style={[StyleSheet.absoluteFill, { opacity: 0.15 }]}
                  />

                  <View style={styles.lockedContent}>
                    <Image source={IMAGES.blocks[3]} style={styles.lockedBlockIcon} resizeMode="contain" />
                    <Text style={[styles.lockedWorldName, { color: world.accentColor }]}>
                      {world.name.toUpperCase()}
                    </Text>
                    <Text style={styles.unlockText}>
                      Complete Level {unlockRequirement} to Unlock
                    </Text>
                    <View style={styles.lockedProgress}>
                      <Text style={styles.lockedProgressText}>
                        {Math.min(unlockedUpTo + 1, unlockRequirement)}/{unlockRequirement}
                      </Text>
                    </View>
                  </View>

                  {/* Decorative glow */}
                  <View style={[styles.lockedGlow, { backgroundColor: world.accentColor }]} />
                </TouchableOpacity>
              </Animated.View>
            );
          }

          // Show unlocked world with levels
          return (
            <Animated.View key={worldIndex} style={[styles.worldSection, animStyle]}>
              {/* World header */}
              <View style={styles.worldHeader}>
                <Text style={[styles.worldName, { color: world.accentColor }]}>
                  {world.name.toUpperCase()}
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressBarBg, { backgroundColor: world.accentColor, opacity: 0.2 }]} />
                  <Animated.View
                    style={[styles.progressFill, {
                      backgroundColor: world.accentColor,
                      width: `${worldProgress}%`,
                    }]}
                  />
                  {/* Glow on progress bar */}
                  <LinearGradient
                    colors={[world.accentColor, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressGlow, {
                      width: `${worldProgress}%`,
                    }]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {completedCount}/{levelsInWorld}
                </Text>
              </View>

              {/* Level circles */}
              <View style={styles.levelRow}>
                {levelIndexes.map((globalIdx, i) => {
                  const isUnlocked = isLevelUnlocked(globalIdx);
                  const stars = levelStars[globalIdx] ?? 0;
                  const isCurrent = globalIdx === nextLevelIndex;
                  const level = LEVELS[globalIdx];

                  return (
                    <TouchableOpacity
                      key={level.id}
                      style={styles.levelCircleWrapper}
                      onPress={() => {
                        if (!isUnlocked) return;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        playSound('level_tap');
                        onSelectLevel(globalIdx);
                      }}
                      disabled={!isUnlocked}
                      activeOpacity={0.8}
                    >
                      {/* Glow on current level */}
                      {isCurrent && (
                        <>
                          <View style={[styles.levelGlow, { backgroundColor: world.accentColor }]} />
                          <View style={[styles.levelGlowOuter, { backgroundColor: world.accentColor }]} />
                        </>
                      )}

                      {/* Circle with enhanced gradient */}
                      <View
                        style={[
                          styles.levelCircle,
                          {
                            borderColor: isCurrent
                              ? world.accentColor
                              : isUnlocked
                              ? 'rgba(255,255,255,0.3)'
                              : 'rgba(255,255,255,0.1)',
                            borderWidth: isCurrent ? 3 : 2,
                            shadowColor: isCurrent ? world.accentColor : '#000',
                            shadowOpacity: isCurrent ? 0.6 : 0.3,
                            shadowRadius: isCurrent ? 12 : 6,
                            elevation: isCurrent ? 8 : 4,
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={
                            isUnlocked
                              ? [world.background[0], world.background[1]]
                              : ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']
                          }
                          style={[StyleSheet.absoluteFill, { borderRadius: 30 }]}
                        />
                        {isUnlocked ? (
                          <>
                            <Text style={[styles.levelNumber, { 
                              color: world.ballColor,
                              textShadowColor: 'rgba(0,0,0,0.5)',
                              textShadowOffset: { width: 0, height: 2 },
                              textShadowRadius: 4,
                            }]}>
                              {globalIdx + 1}
                            </Text>
                            {level.isBoss && (
                              <Image source={IMAGES.boss} style={styles.bossBadge} resizeMode="contain" />
                            )}
                          </>
                        ) : (
                          <Image source={IMAGES.blocks[3]} style={styles.lockIcon} resizeMode="contain" />
                        )}
                      </View>

                      {/* Stars */}
                      {isUnlocked && (
                        <View style={styles.starsWrap}>
                          {stars === 3 && (
                            <Animated.View
                              style={[
                                styles.starShimmer,
                                {
                                  opacity: starShimmerOpacity,
                                  transform: [
                                    { rotate: starShimmerRotate },
                                    { scale: starShimmerScale },
                                  ],
                                },
                              ]}
                            >
                              <View style={[styles.sparkleDot, styles.sparkleTop]} />
                              <View style={[styles.sparkleDot, styles.sparkleRight]} />
                              <View style={[styles.sparkleDot, styles.sparkleBottom]} />
                              <View style={[styles.sparkleDot, styles.sparkleLeft]} />
                            </Animated.View>
                          )}
                          <View style={styles.starsRow}>
                            {[0, 1, 2].map((s) => (
                              <Text
                                key={s}
                                style={[
                                  styles.starIcon,
                                  s < stars ? styles.starEarned : styles.starEmpty,
                                ]}
                              >
                                ★
                              </Text>
                            ))}
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        soundEnabled={soundEnabled}
        hapticsEnabled={hapticsEnabled}
        plusActive={plusActive}
        onClose={() => setSettingsVisible(false)}
        onUpdateSettings={onUpdateSettings}
        onOpenPlus={() => {
          setSettingsVisible(false);
          onOpenPlus();
        }}
      />
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SW,
    height: SH,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  playerBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  badgeLevel: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badgeGlow: {
    position: 'absolute',
    width: 58,
    height: 34,
    opacity: 0.55,
  },
  bobaCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60,30,10,0.85)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  energyCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60,30,10,0.85)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  energyIcon: {
    width: 25,
    height: 25,
  },
  energyText: {
    color: '#FFF',
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
  },
  energySub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bobaIconText: {
    fontSize: 17,
    lineHeight: 20,
  },
  bobaText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  settingsBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(60,30,10,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  settingsIcon: {
    width: 42,
    height: 42,
  },
  scroll: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  mascotContainer: {
    marginTop: 20,
    marginBottom: 16,
  },
  mascot: {
    width: 180,
    height: 180,
  },
  title: {
    fontSize: 56,
    fontWeight: '900',
    color: '#6B3E1F',
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B5A2B',
    marginTop: 4,
    marginBottom: 28,
    letterSpacing: 1,
  },
  continueBtn: {
    width: SW - 64,
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
    marginBottom: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  continueBtnText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
  },
  continueBtnSub: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  worldSection: {
    width: SW - 40,
    marginBottom: 24,
  },
  worldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  worldName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
  },
  progressGlow: {
    position: 'absolute',
    height: '100%',
    opacity: 0.4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 12,
  },
  levelCircleWrapper: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingVertical: 4,
  },
  levelGlow: {
    position: 'absolute',
    top: -5,
    left: '50%',
    marginLeft: -35,
    width: 70,
    height: 70,
    borderRadius: 35,
    opacity: 0.3,
  },
  levelGlowOuter: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.15,
  },
  levelCircle: {
    width: 60,
    height: 60,
    minWidth: 60,
    minHeight: 60,
    maxWidth: 60,
    maxHeight: 60,
    borderRadius: 30,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  levelNumber: {
    fontSize: 24,
    fontWeight: '900',
  },
  bossBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 24,
    height: 24,
  },
  lockIcon: {
    width: 30,
    height: 30,
    opacity: 0.75,
  },
  starsWrap: {
    width: 62,
    minHeight: 18,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 1,
  },
  starIcon: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  starEarned: {
    color: '#FFD45C',
    textShadowColor: 'rgba(86, 39, 7, 0.75)',
  },
  starEmpty: {
    color: 'rgba(95, 51, 23, 0.72)',
    textShadowColor: 'rgba(255, 238, 178, 0.42)',
  },
  starShimmer: {
    position: 'absolute',
    width: 58,
    height: 24,
    top: -3,
    left: 2,
  },
  sparkleDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF3A7',
    shadowColor: '#FFD45C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 4,
  },
  sparkleTop: {
    top: 1,
    left: 27,
  },
  sparkleRight: {
    top: 10,
    right: 0,
  },
  sparkleBottom: {
    bottom: 0,
    left: 30,
  },
  sparkleLeft: {
    top: 10,
    left: 0,
  },
  // Locked World Card Styles
  lockedWorldCard: {
    width: '100%',
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  lockedContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  lockedBlockIcon: {
    width: 42,
    height: 42,
    marginBottom: 8,
    opacity: 0.75,
  },
  lockedWorldName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  unlockText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
  },
  lockedProgress: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  lockedProgressText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  lockedGlow: {
    position: 'absolute',
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.1,
  },
});
