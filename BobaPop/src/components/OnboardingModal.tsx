import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IMAGES } from '../assets/images';

interface Props {
  visible: boolean;
  onDone: () => void;
}

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  art: ImageSourcePropType;
  accent: string;
  supportingArt?: ImageSourcePropType;
}

const { width: SW, height: SH } = Dimensions.get('window');

const SLIDES: Slide[] = [
  {
    eyebrow: 'Welcome',
    title: 'Pop every boba',
    body: 'Clear blocks, catch rebounds, and keep the cup moving.',
    art: IMAGES.mascotHappy,
    accent: '#F5A623',
    supportingArt: IMAGES.ball,
  },
  {
    eyebrow: 'Control',
    title: 'Tap, drag, release',
    body: 'Aim with the paddle. A clean edge hit sends the boba wide.',
    art: IMAGES.paddle,
    accent: '#3D7A57',
    supportingArt: IMAGES.ballHot,
  },
  {
    eyebrow: 'Boosts',
    title: 'Power-ups change runs',
    body: 'Multi-ball, sticky catches, slow motion, and wider paddles can save a level.',
    art: IMAGES.ballMulti,
    accent: '#7B5AC8',
    supportingArt: IMAGES.paddleWide,
  },
  {
    eyebrow: 'Boss Boba',
    title: 'Protect the sweetness',
    body: 'Defeat the boss before it ruins your sweetness.',
    art: IMAGES.boss,
    accent: '#FF6A3D',
    supportingArt: IMAGES.mascotExcited,
  },
  {
    eyebrow: 'Lives',
    title: 'Fresh tries refill',
    body: 'Starting or retrying spends one life. Ads continue the same run without spending one.',
    art: IMAGES.lifeIcon,
    accent: '#B85B16',
    supportingArt: IMAGES.mascotExcited,
  },
];

export const OnboardingModal: React.FC<Props> = ({ visible, onDone }) => {
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const dots = useMemo(() => SLIDES.map((_, i) => i), []);

  const moveTo = (nextIndex: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setIndex(nextIndex);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const handlePrimary = () => {
    if (isLast) {
      onDone();
      return;
    }
    moveTo(index + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        <LinearGradient
          colors={['#2A0F05', '#7A421C', '#F2BE68']}
          style={StyleSheet.absoluteFill}
        />
        <Image source={IMAGES.backgrounds[0]} style={styles.bgImage} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(20,8,2,0.72)', 'rgba(20,8,2,0.22)', 'rgba(20,8,2,0.62)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.topRow}>
          <Text style={styles.brand}>BobaPop</Text>
          <Pressable onPress={onDone} hitSlop={14}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={[styles.eyebrowPill, { borderColor: slide.accent }]}>
            <Text style={[styles.eyebrow, { color: slide.accent }]}>{slide.eyebrow}</Text>
          </View>

          <View style={styles.artStage}>
            <View style={[styles.artGlow, { backgroundColor: slide.accent }]} />
            {slide.supportingArt && (
              <Image source={slide.supportingArt} style={styles.supportingArt} resizeMode="contain" />
            )}
            <Image source={slide.art} style={styles.mainArt} resizeMode="contain" />
          </View>

          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </Animated.View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {dots.map((dot) => (
              <View
                key={dot}
                style={[
                  styles.dot,
                  dot === index && [styles.dotActive, { backgroundColor: slide.accent }],
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handlePrimary}
            activeOpacity={0.86}
          >
            <LinearGradient
              colors={[slide.accent, '#54280C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.primaryText}>{isLast ? 'Start Popping' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    width: SW,
    height: SH,
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 34,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.26,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#FFF4DB',
    fontSize: 19,
    fontWeight: '900',
  },
  skip: {
    color: 'rgba(255,244,219,0.78)',
    fontSize: 15,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowPill: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  artStage: {
    width: Math.min(310, SW - 60),
    height: Math.min(280, SH * 0.32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  artGlow: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    opacity: 0.24,
    transform: [{ scaleX: 1.24 }],
  },
  mainArt: {
    width: '76%',
    height: '76%',
  },
  supportingArt: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 92,
    height: 92,
    opacity: 0.92,
    transform: [{ rotate: '-8deg' }],
  },
  title: {
    color: '#FFF4DB',
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.38)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  body: {
    color: 'rgba(255,244,219,0.86)',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 330,
  },
  footer: {
    gap: 18,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dotActive: {
    width: 26,
  },
  primaryBtn: {
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryText: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
