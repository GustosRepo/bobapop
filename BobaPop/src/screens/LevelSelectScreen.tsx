import React, { useEffect, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WORLDS } from '../constants/themes';
import { IMAGES } from '../assets/images';
import { LevelGrid } from '../components/LevelGrid';
import { FloatingBobas } from '../components/FloatingBobas';

interface Props {
  unlockedUpTo: number;
  levelStars: Record<number, number>;
  levelHighScores: Record<number, number>;
  totalBobas: number;
  onSelectLevel: (index: number) => void;
}

const { width: SW, height: SH } = Dimensions.get('screen');

// ─── Per-world section ────────────────────────────────────────────────────────
interface WorldSectionProps {
  worldIndex: number;
  unlockedUpTo: number;
  levelStars: Record<number, number>;
  levelHighScores: Record<number, number>;
  onSelectLevel: (index: number) => void;
}

const WorldSection: React.FC<WorldSectionProps> = ({
  worldIndex,
  unlockedUpTo,
  levelStars,
  levelHighScores,
  onSelectLevel,
}) => {
  const world = WORLDS[worldIndex];
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 400,
      delay: worldIndex * 80,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateX = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  return (
    <View style={styles.worldSection}>
      {/* World banner */}
      <Animated.View
        style={[
          styles.worldBanner,
          { borderLeftColor: world.accentColor, opacity: headerAnim, transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={[world.accentColor + '28', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.worldName, { color: world.accentColor }]}>{world.name}</Text>
        <View style={styles.worldPips}>
          {[0, 1, 2, 3, 4].map((i) => {
            const globalIdx = worldIndex * 5 + i;
            const done = (levelStars[globalIdx] ?? 0) > 0;
            return (
              <View
                key={i}
                style={[
                  styles.pip,
                  {
                    backgroundColor: done
                      ? world.accentColor
                      : globalIdx <= unlockedUpTo
                      ? world.accentColor + '50'
                      : 'rgba(255,255,255,0.10)',
                  },
                ]}
              />
            );
          })}
        </View>
      </Animated.View>

      {/* Card grid */}
      <LevelGrid
        worldIndex={worldIndex}
        world={world}
        unlockedUpTo={unlockedUpTo}
        levelStars={levelStars}
        levelHighScores={levelHighScores}
        onSelectLevel={onSelectLevel}
      />
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export const LevelSelectScreen: React.FC<Props> = ({
  unlockedUpTo,
  levelStars,
  levelHighScores,
  totalBobas,
  onSelectLevel,
}) => {
  const logoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(logoAnim, {
      toValue: 1,
      speed: 4,
      bounciness: 14,
      useNativeDriver: true,
    }).start();
  }, []);

  const logoScale = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <ImageBackground
      source={IMAGES.backgrounds[0]}
      style={styles.root}
      resizeMode="cover"
    >
      {/* Warm dark overlay */}
      <LinearGradient
        colors={['rgba(16,5,1,0.88)', 'rgba(20,7,2,0.72)', 'rgba(16,5,1,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      {/* Floating boba balls drifting up in the background */}
      <FloatingBobas />
      <StatusBar hidden />

      {/* ── Header ── */}
      <Animated.View
        style={[styles.header, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}
      >
        <Image source={IMAGES.mascotHappy} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>BobaPop</Text>
        <Text style={styles.subtitle}>by CODEWERX LLC</Text>
        {totalBobas > 0 && (
          <Text style={styles.bobaCount}>
            🧋 {totalBobas.toLocaleString()} bobas popped
          </Text>
        )}
      </Animated.View>

      {/* ── Worlds ── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {WORLDS.map((_, wi) => (
          <WorldSection
            key={wi}
            worldIndex={wi}
            unlockedUpTo={unlockedUpTo}
            levelStars={levelStars}
            levelHighScores={levelHighScores}
            onSelectLevel={onSelectLevel}
          />
        ))}
      </ScrollView>
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
  header: {
    alignItems: 'center',
    paddingTop: 68,
    paddingBottom: 16,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 6,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  bobaCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.60)',
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 64,
    gap: 24,
  },
  worldSection: {
    gap: 12,
  },
  worldBanner: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  worldName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  worldPips: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
