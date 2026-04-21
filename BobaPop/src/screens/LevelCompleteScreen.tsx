import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WorldTheme } from '../constants/themes';
import { IMAGES } from '../assets/images';

interface Props {
  score: number;
  stars: number;
  levelNumber: number;
  theme: WorldTheme;
  isLast: boolean;
  isWorldBoss: boolean;
  onNext: () => void;
  onReplay: () => void;
  onMenu: () => void;
}

const { width: SW } = Dimensions.get('window');

export const LevelCompleteScreen: React.FC<Props> = ({
  score,
  stars,
  levelNumber,
  theme,
  isLast,
  isWorldBoss,
  onNext,
  onReplay,
  onMenu,
}) => {
  const title = isLast
    ? 'All Worlds Cleared!'
    : isWorldBoss
    ? '⭐ World Cleared! ⭐'
    : 'Level Complete!';

  // ── Star pop-in animation ───────────────────────────────────────────────
  const starAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    Animated.stagger(
      200,
      starAnims.map((a) =>
        Animated.spring(a, {
          toValue: 1,
          speed: 7,
          bounciness: 18,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, []);

  return (
    <LinearGradient colors={theme.background as [string, string, string]} style={styles.root}>
      <StatusBar hidden />
      <View style={styles.content}>
        <Image
          source={isWorldBoss ? IMAGES.mascotExcited : IMAGES.mascotHappy}
          style={styles.mascot}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: theme.ballColor }]}>{title}</Text>
        {isWorldBoss && (
          <Text style={[styles.bossTag, { backgroundColor: theme.accentColor + '33', borderColor: theme.accentColor }]}>
            👾 Boss Defeated!
          </Text>
        )}
        <Text style={[styles.levelText, { color: theme.accentColor }]}>
          Level {levelNumber}
        </Text>

        {/* Stars pop-in */}
        <View style={styles.starsRow}>
          {[0, 1, 2].map((i) => {
            const earned = i < stars;
            const scaleInterp = starAnims[i].interpolate({
              inputRange: [0, 1],
              outputRange: [0.1, 1],
              extrapolate: 'clamp',
            });
            const opacityInterp = starAnims[i].interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [0, 1, 1],
              extrapolate: 'clamp',
            });
            return (
              <Animated.Text
                key={i}
                style={[
                  styles.bigStar,
                  {
                    color: earned ? '#FFD700' : 'rgba(255,255,255,0.18)',
                    transform: [{ scale: scaleInterp }],
                    opacity: opacityInterp,
                  },
                ]}
              >
                ★
              </Animated.Text>
            );
          })}
        </View>

        <View style={[styles.scoreCard, { backgroundColor: theme.accentColor + '22', borderColor: theme.accentColor }]}>
          <Text style={[styles.scoreLabel, { color: theme.accentColor }]}>Score</Text>
          <Text style={[styles.scoreValue, { color: theme.ballColor }]}>
            {score.toLocaleString()}
          </Text>
        </View>

        <View style={styles.buttons}>
          {!isLast && (
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.paddleColor }]}
              onPress={onNext}
            >
              <Text style={styles.btnTextPrimary}>
                {isWorldBoss ? 'Next World →' : 'Next Level →'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btn, { borderColor: theme.accentColor, borderWidth: 1.5 }]}
            onPress={onReplay}
          >
            <Text style={[styles.btnTextSecondary, { color: theme.accentColor }]}>Replay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={onMenu}>
            <Text style={[styles.menuText, { color: theme.accentColor }]}>← Levels</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
    width: SW,
  },
  mascot: {
    width: 140,
    height: 140,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  levelText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scoreCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 24,
    alignItems: 'center',
    marginVertical: 8,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
  },
  buttons: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnPrimary: {},
  btnTextPrimary: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  btnTextSecondary: {
    fontSize: 17,
    fontWeight: '600',
  },
  menuBtn: {
    marginTop: 4,
    alignSelf: 'center',
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
  },
  bigStar: {
    fontSize: 52,
  },
  bigStar: {
    fontSize: 52,
  },
  bossTag: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    overflow: 'hidden',
    marginBottom: 4,
  },
});
