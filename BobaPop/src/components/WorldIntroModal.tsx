import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WorldTheme } from '../constants/themes';
import { IMAGES } from '../assets/images';

// ─── World-specific copy ───────────────────────────────────────────────────────
const WORLD_FLAVOR: Record<number, string> = {
  0: 'Caramelized & rich.\nThe classic foundation.',
  1: 'Earthy & smooth.\nZen your way to victory.',
  2: 'Mysterious & dreamy.\nThe purple rush awaits.',
  3: 'Bold & spiced.\nThe ultimate challenge.',
};

const WORLD_EMOJI: Record<number, string> = {
  0: '🧋',
  1: '🍵',
  2: '💜',
  3: '🌶️',
};

const AUTO_DISMISS_MS = 3500;

const { width: SW, height: SH } = Dimensions.get('screen');

interface Props {
  worldIndex: number;
  world: WorldTheme;
  onDone: () => void;
}

export const WorldIntroModal: React.FC<Props> = ({ worldIndex, world, onDone }) => {
  const scaleAnim    = useRef(new Animated.Value(0.90)).current;
  const opacityAnim  = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef     = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, speed: 7, bounciness: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss countdown bar
    const prog = Animated.timing(progressAnim, {
      toValue: 1,
      duration: AUTO_DISMISS_MS,
      useNativeDriver: false,  // animating width — can't use native driver
    });
    timerRef.current = prog;
    prog.start(({ finished }) => {
      if (finished) onDone();
    });

    return () => timerRef.current?.stop();
  }, []);

  const handleDone = () => {
    timerRef.current?.stop();
    onDone();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal transparent animationType="none" statusBarTranslucent>
      <StatusBar hidden />
      <Animated.View
        style={[styles.root, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
      >
        {/* World background */}
        <LinearGradient
          colors={world.background as [string, string, string]}
          style={StyleSheet.absoluteFill}
        />
        {/* Subtle vignette */}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.4)']}
          style={StyleSheet.absoluteFill}
        />

        {/* ── Content ── */}
        <View style={styles.content}>
          {/* World badge pill */}
          <View style={[styles.badge, { borderColor: world.accentColor + '99', backgroundColor: world.accentColor + '22' }]}>
            <Text style={[styles.badgeText, { color: world.accentColor }]}>
              WORLD {worldIndex + 1}
            </Text>
          </View>

          {/* Big emoji */}
          <Text style={styles.emoji}>{WORLD_EMOJI[worldIndex] ?? '🧋'}</Text>

          {/* World name */}
          <Text style={[styles.worldName, { color: world.ballColor }]}>{world.name}</Text>

          {/* Flavor tagline */}
          <Text style={[styles.flavor, { color: world.accentColor + 'DD' }]}>
            {WORLD_FLAVOR[worldIndex] ?? ''}
          </Text>

          {/* Mascot */}
          <Image source={IMAGES.mascotExcited} style={styles.mascot} resizeMode="contain" />

          {/* CTA */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: world.accentColor }]}
            onPress={handleDone}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>Let's Pop! →</Text>
          </TouchableOpacity>
        </View>

        {/* Auto-dismiss progress bar along bottom */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth, backgroundColor: world.accentColor }]}
          />
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    width: SW,
    height: SH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 36,
    gap: 0,
  },
  badge: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
  },
  emoji: {
    fontSize: 76,
    marginBottom: 10,
  },
  worldName: {
    fontSize: 52,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
    marginBottom: 14,
  },
  flavor: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 20,
  },
  mascot: {
    width: 150,
    height: 150,
    marginBottom: 28,
  },
  btn: {
    paddingHorizontal: 52,
    paddingVertical: 18,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  progressFill: {
    height: 3,
  },
});
