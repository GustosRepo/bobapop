import { Animated, View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { IMAGES } from '../assets/images';
import { LEVELS } from '../game/levels';
import { WorldTheme } from '../constants/themes';
import { styles } from '../screens/LevelSelectScreen.styles';

interface Props {
  world: WorldTheme; worldIndex: number; indexes: number[]; unlockedUpTo: number;
  isLevelUnlocked: (index: number) => boolean; levelStars: Record<number, number>;
  worldAnim: Animated.Value; nextLevelIndex: number; hapticsEnabled: boolean;
  playSound: (event: 'level_tap') => void; onSelectLevel: (index: number) => void;
  shimmer: { opacity: Animated.AnimatedInterpolation<number>; rotate: Animated.AnimatedInterpolation<string>; scale: Animated.AnimatedInterpolation<number> };
}

export function LevelWorldSection({ world, worldIndex, indexes, unlockedUpTo, isLevelUnlocked,
  levelStars, worldAnim, nextLevelIndex, hapticsEnabled, playSound, onSelectLevel, shimmer }: Props) {
          const levelIndexes = indexes;
          const levelsInWorld = levelIndexes.length;
          const completedCount = levelIndexes
            .filter((idx) => (levelStars[idx] ?? 0) > 0).length;
          const worldProgress = levelsInWorld > 0 ? (completedCount / levelsInWorld) * 100 : 0;
          
          const isWorldUnlocked = indexes.some(isLevelUnlocked);
          

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
                <TouchableOpacity accessibilityRole="button"
                  style={styles.lockedWorldCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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

              {[...new Set(levelIndexes.map((index) => LEVELS[index].chapter ?? 1))].map((chapter) => {
                const chapterIndexes = levelIndexes.filter((index) => (LEVELS[index].chapter ?? 1) === chapter);
                const chapterUnlocked = chapterIndexes.some(isLevelUnlocked);
                const chapterCompleted = chapterIndexes.filter((index) => (levelStars[index] ?? 0) > 0).length;
                return (
                  <View key={chapter} style={styles.chapterSection}>
                    <View style={styles.chapterHeader}>
                      <Text style={[styles.chapterTitle, { color: world.accentColor }]}>Chapter {chapter} · {chapterIndexes[0] + 1}–{chapterIndexes[chapterIndexes.length - 1] + 1}</Text>
                      <Text style={styles.progressText}>{chapterCompleted}/{chapterIndexes.length}</Text>
                    </View>
                    {!chapterUnlocked && <Text style={styles.chapterHint}>Complete Level {chapterIndexes[0]} to unlock</Text>}
                    <View style={styles.levelRow}>
                {chapterIndexes.map((globalIdx) => {
                  const isUnlocked = isLevelUnlocked(globalIdx);
                  const stars = levelStars[globalIdx] ?? 0;
                  const isCurrent = globalIdx === nextLevelIndex;
                  const level = LEVELS[globalIdx];

                  return (
                    <TouchableOpacity
                      key={level.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Level ${globalIdx + 1}${level.name ? `, ${level.name}` : ""}${level.isBoss ? ", boss" : ""}, ${stars} of 3 stars`}
                      accessibilityState={{ disabled: !isUnlocked }}
                      style={styles.levelCircleWrapper}
                      onPress={() => {
                        if (!isUnlocked) return;
                        if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                                  opacity: shimmer.opacity,
                                  transform: [
                                    { rotate: shimmer.rotate },
                                    { scale: shimmer.scale },
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
                  </View>
                );
              })}
            </Animated.View>
          );

}
