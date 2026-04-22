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
  levelStars: Record<number, number>;
  levelHighScores: Record<number, number>;
  totalBobas: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  onSelectLevel: (index: number) => void;
  onUpdateSettings: (sound: boolean, haptics: boolean) => void;
}

const { width: SW, height: SH } = Dimensions.get('window');

// Player level calculation based on total stars
function calculatePlayerLevel(totalStars: number): { level: number; title: string; emoji: string } {
  if (totalStars >= 60) return { level: 10, title: 'Boba Master', emoji: '👑' };
  if (totalStars >= 54) return { level: 9, title: 'Boba Legend', emoji: '💎' };
  if (totalStars >= 48) return { level: 8, title: 'Boba Expert', emoji: '🏆' };
  if (totalStars >= 42) return { level: 7, title: 'Boba Pro', emoji: '⭐' };
  if (totalStars >= 36) return { level: 6, title: 'Boba Ace', emoji: '🎯' };
  if (totalStars >= 30) return { level: 5, title: 'Boba Adept', emoji: '🔥' };
  if (totalStars >= 24) return { level: 4, title: 'Boba Slurper', emoji: '🧋' };
  if (totalStars >= 18) return { level: 3, title: 'Boba Fan', emoji: '💫' };
  if (totalStars >= 12) return { level: 2, title: 'Boba Novice', emoji: '✨' };
  if (totalStars >= 6) return { level: 1, title: 'Boba Beginner', emoji: '🌟' };
  return { level: 0, title: 'New Popper', emoji: '🎈' };
}

export const LevelSelectScreen: React.FC<Props> = ({
  unlockedUpTo,
  levelStars,
  levelHighScores,
  totalBobas,
  soundEnabled,
  hapticsEnabled,
  onSelectLevel,
  onUpdateSettings,
}) => {
  const { playSound } = useSound();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const mascotAnim = useRef(new Animated.Value(0)).current;
  const worldAnims = useRef(WORLDS.map(() => new Animated.Value(0))).current;

  // Calculate player level
  const totalStars = useMemo(() => {
    return Object.values(levelStars).reduce((sum, stars) => sum + stars, 0);
  }, [levelStars]);
  const playerLevel = calculatePlayerLevel(totalStars);

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

  const mascotScale = mascotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  // Find the next level to play
  const nextLevelIndex = Math.min(unlockedUpTo, LEVELS.length - 1);
  const nextLevel = LEVELS[nextLevelIndex];
  const nextWorld = WORLDS[nextLevel.worldIndex];

  // Determine which worlds are unlocked
  const unlockedWorlds = useMemo(() => {
    const worlds = new Set<number>();
    for (let i = 0; i <= unlockedUpTo; i++) {
      worlds.add(LEVELS[i].worldIndex);
    }
    return worlds;
  }, [unlockedUpTo]);

  return (
    <ImageBackground
      source={IMAGES.backgrounds[0]}
      style={styles.root}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(232,212,184,0.88)', 'rgba(212,184,150,0.92)', 'rgba(201,169,118,0.90)']}
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
          <Text style={styles.badgeLevel}>{playerLevel.level}</Text>
        </TouchableOpacity>

        {/* Boba Counter */}
        <View style={styles.bobaCounter}>
          <Image source={IMAGES.lifeIcon} style={styles.bobaIcon} resizeMode="contain" />
          <Text style={styles.bobaText}>{totalBobas.toLocaleString()}</Text>
        </View>

        {/* Settings Button */}
        <TouchableOpacity style={styles.settingsBtn} onPress={() => {
          if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          playSound('level_tap');
          setSettingsVisible(true);
        }}>
          <Text style={styles.settingsIcon}>⚙️</Text>
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
            Level {nextLevelIndex + 1}
          </Text>
        </TouchableOpacity>

        {/* ── World Sections ── */}
        {WORLDS.map((world, worldIndex) => {
          const firstLevel = worldIndex * 5;
          const levelsInWorld = LEVELS.filter((l) => l.worldIndex === worldIndex).length;
          const completedCount = Array.from({ length: levelsInWorld }, (_, i) => firstLevel + i)
            .filter((idx) => (levelStars[idx] ?? 0) > 0).length;
          
          const isWorldUnlocked = unlockedWorlds.has(worldIndex);
          const worldAnim = worldAnims[worldIndex];

          // Calculate unlock requirement for locked worlds
          const unlockRequirement = worldIndex > 0 ? (worldIndex * 5) : 0;

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
                    <Text style={styles.lockIconBig}>🔒</Text>
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
                      width: `${(completedCount / levelsInWorld) * 100}%`,
                    }]}
                  />
                  {/* Glow on progress bar */}
                  <LinearGradient
                    colors={[world.accentColor, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressGlow, {
                      width: `${(completedCount / levelsInWorld) * 100}%`,
                    }]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {completedCount}/{levelsInWorld}
                </Text>
              </View>

              {/* Level circles */}
              <View style={styles.levelRow}>
                {Array.from({ length: levelsInWorld }).map((_, i) => {
                  const globalIdx = firstLevel + i;
                  const isUnlocked = globalIdx <= unlockedUpTo;
                  const stars = levelStars[globalIdx] ?? 0;
                  const isCurrent = globalIdx === nextLevelIndex;
                  const level = LEVELS[globalIdx];

                  return (
                    <TouchableOpacity
                      key={i}
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
                              <Text style={styles.bossBadge}>👾</Text>
                            )}
                          </>
                        ) : (
                          <Text style={styles.lockIcon}>🔒</Text>
                        )}
                      </View>

                      {/* Stars */}
                      {isUnlocked && (
                        <View style={styles.starsRow}>
                          {[0, 1, 2].map((s) => (
                            <Text key={s} style={styles.starIcon}>
                              {s < stars ? '⭐' : '☆'}
                            </Text>
                          ))}
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
        onClose={() => setSettingsVisible(false)}
        onUpdateSettings={onUpdateSettings}
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
  bobaCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60,30,10,0.85)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  bobaIcon: {
    width: 26,
    height: 26,
  },
  bobaText: {
    color: '#FFF',
    fontSize: 18,
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
    fontSize: 28,
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
    top: -4,
    right: -4,
    fontSize: 16,
  },
  lockIcon: {
    fontSize: 24,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  starIcon: {
    fontSize: 11,
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
  lockIconBig: {
    fontSize: 36,
    marginBottom: 8,
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
