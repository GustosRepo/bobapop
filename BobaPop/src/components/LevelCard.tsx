import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { WorldTheme } from '../constants/themes';
import { useSound } from '../hooks/useSound';

// ─── Particle burst config ────────────────────────────────────────────────────
const P_COUNT  = 8;
// Evenly spread angles (degrees) with slight natural variation
const P_ANGLES = [0, 44, 90, 135, 185, 225, 272, 318] as const;
// Travel distance per particle (px)
const P_DIST   = [38, 46, 36, 52, 40, 44, 34, 50] as const;
// true = gold star glint, false = accent-colored pearl
const P_GOLD   = [false, true, false, false, true, false, true, false] as const;

interface Props {
  levelIndex: number;   // 0-based global
  unlocked: boolean;
  stars: number;         // 0–3
  highScore?: number;
  size: number;
  world: WorldTheme;
  mountDelay: number;
  onPress: () => void;
}

export const LevelCard: React.FC<Props> = ({
  levelIndex,
  unlocked,
  stars,
  highScore,
  size,
  world,
  mountDelay,
  onPress,
}) => {
  const locked = !unlocked;
  const completed = stars > 0;
  const { playSound } = useSound();

  // ─── Animations ──────────────────────────────────────────────────────────
  const mountAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  // One Animated.Value per particle (0 = idle, 1 = burst complete)
  const particleAnims = useRef(
    Array.from({ length: P_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    Animated.timing(mountAnim, {
      toValue: 1,
      duration: 380,
      delay: mountDelay,
      useNativeDriver: true,
    }).start();
  }, []);

  const triggerBurst = useCallback(() => {
    particleAnims.forEach((a) => a.setValue(0));
    Animated.parallel(
      particleAnims.map((a) =>
        Animated.timing(a, { toValue: 1, duration: 520, useNativeDriver: true }),
      ),
    ).start();
  }, [particleAnims]);

  const handlePressIn = () => {
    if (locked) return;
    triggerBurst();
    playSound('level_tap');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(pressAnim, {
      toValue: 0.88,
      speed: 60,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (locked) return;
    Animated.spring(pressAnim, {
      toValue: 1,
      speed: 12,
      bounciness: 16,
      useNativeDriver: true,
    }).start();
  };

  const mountTranslateY = mountAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  // ─── Visuals ──────────────────────────────────────────────────────────────
  const cardWidth = size;
  const cardHeight = Math.round(size * 1.4);

  let gradStart: string;
  let gradEnd: string;
  let borderColor: string;

  if (locked) {
    gradStart = 'rgba(255,255,255,0.05)';
    gradEnd   = 'rgba(255,255,255,0.02)';
    borderColor = 'rgba(255,255,255,0.09)';
  } else if (completed) {
    gradStart   = world.accentColor + '70';
    gradEnd     = world.accentColor + '28';
    borderColor = world.accentColor + 'CC';
  } else {
    gradStart   = world.accentColor + '42';
    gradEnd     = world.accentColor + '14';
    borderColor = world.accentColor + '88';
  }

  return (
    // overflow: 'visible' so particles escape the card boundary
    <Animated.View
      style={{
        opacity: mountAnim,
        transform: [{ translateY: mountTranslateY }, { scale: pressAnim }],
        overflow: 'visible',
      }}
    >
      <TouchableWithoutFeedback
        onPress={() => !locked && onPress()}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View
          style={[
            styles.card,
            {
              width: cardWidth,
              height: cardHeight,
              borderColor,
              shadowColor: locked ? '#000' : world.accentColor,
              shadowOpacity: locked ? 0.0 : completed ? 0.7 : 0.45,
            },
          ]}
        >
          <LinearGradient
            colors={[gradStart, gradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Completed shine strip */}
          {completed && (
            <View style={styles.shineStrip} />
          )}

          {locked ? (
            <Text style={styles.lockIcon}>🔒</Text>
          ) : (
            <>
              <Text style={styles.levelNum}>{levelIndex + 1}</Text>
              <View style={styles.starsRow}>
                {[0, 1, 2].map((i) => (
                  <Text
                    key={i}
                    style={[styles.star, { opacity: i < stars ? 1 : 0.18 }]}
                  >
                    ★
                  </Text>
                ))}
              </View>
              {completed && highScore != null && highScore > 0 && (
                <Text style={styles.highScore}>{highScore.toLocaleString()}</Text>
              )}
            </>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* ── Particle burst ─────────────────────────────────────────────── */}
      {!locked && particleAnims.map((anim, i) => {
        const angleRad = (P_ANGLES[i] * Math.PI) / 180;
        const dist     = P_DIST[i];
        const isGlint  = P_GOLD[i];
        const pSize    = isGlint ? 6 : 8;
        const color    = isGlint ? '#FFD700' : world.accentColor;

        const tx = anim.interpolate({
          inputRange:  [0, 1],
          outputRange: [0, Math.cos(angleRad) * dist],
        });
        const ty = anim.interpolate({
          inputRange:  [0, 1],
          outputRange: [0, Math.sin(angleRad) * dist],
        });
        const opacity = anim.interpolate({
          inputRange:  [0, 0.15, 0.6, 1],
          outputRange: [0, 1,    0.8, 0],
        });
        const scale = anim.interpolate({
          inputRange:  [0, 0.2, 0.7, 1],
          outputRange: [0, 1.3, 1,   0.4],
        });

        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top:  cardHeight / 2 - pSize / 2,
              left: cardWidth  / 2 - pSize / 2,
              width:  pSize,
              height: pSize,
              // pearl = circle, glint = tiny rotated square for sparkle look
              borderRadius: isGlint ? 1 : pSize / 2,
              backgroundColor: color,
              opacity,
              transform: [
                { translateX: tx },
                { translateY: ty },
                { scale },
                ...(isGlint ? [{ rotate: '45deg' }] : []),
              ],
            }}
          />
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // iOS shadow
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    // Android
    elevation: 6,
  },
  shineStrip: {
    position: 'absolute',
    top: 0,
    left: '15%',
    width: '40%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  lockIcon: {
    fontSize: 18,
  },
  levelNum: {
    fontSize: 19,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    lineHeight: 22,
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 5,
    gap: 2,
  },
  star: {
    fontSize: 11,
    color: '#FFD700',
    lineHeight: 13,
  },
  highScore: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
