import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WorldTheme } from '../constants/themes';
import { IMAGES } from '../assets/images';

interface Props {
  score: number;
  levelNumber: number;
  theme: WorldTheme;
  onRetry: () => void;
  onMenu: () => void;
}

const { width: SW } = Dimensions.get('window');

export const GameOverScreen: React.FC<Props> = ({
  score,
  levelNumber,
  theme,
  onRetry,
  onMenu,
}) => {
  return (
    <LinearGradient colors={['#0A0A0A', '#1A0A0A', '#2A0A0A']} style={styles.root}>
      <StatusBar hidden />
      <View style={styles.content}>
        <Image source={IMAGES.mascotSad} style={styles.mascot} resizeMode="contain" />
        <Text style={styles.title}>Game Over</Text>
        <Text style={[styles.levelText, { color: theme.accentColor }]}>
          Level {levelNumber}
        </Text>

        <View style={[styles.scoreCard, { backgroundColor: theme.accentColor + '15', borderColor: theme.accentColor + '55' }]}>
          <Text style={[styles.scoreLabel, { color: theme.accentColor }]}>Score</Text>
          <Text style={styles.scoreValue}>{score.toLocaleString()}</Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.paddleColor }]}
            onPress={onRetry}
          >
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline, { borderColor: theme.accentColor }]}
            onPress={onMenu}
          >
            <Text style={[styles.btnTextOutline, { color: theme.accentColor }]}>← Levels</Text>
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
    width: 130,
    height: 130,
    marginBottom: 8,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
  },
  levelText: {
    fontSize: 15,
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
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
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
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  btnOutline: {
    borderWidth: 1.5,
  },
  btnTextOutline: {
    fontSize: 17,
    fontWeight: '600',
  },
});
