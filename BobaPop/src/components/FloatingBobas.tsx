import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, View } from 'react-native';
import { IMAGES } from '../assets/images';

const { width: SW, height: SH } = Dimensions.get('screen');

interface BobaConfig {
  x: number;          // % of screen width
  size: number;       // px
  duration: number;   // ms for one full rise
  delay: number;      // ms before first animation starts
  opacity: number;
  driftAmp: number;   // horizontal sway in px
}

// Deterministic config — no Math.random at render time so values are stable
const BOBAS: BobaConfig[] = [
  { x: 0.08, size: 22, duration: 7200, delay: 0,    opacity: 0.18, driftAmp: 14 },
  { x: 0.20, size: 14, duration: 9000, delay: 1400, opacity: 0.13, driftAmp: 10 },
  { x: 0.35, size: 30, duration: 8100, delay: 600,  opacity: 0.20, driftAmp: 18 },
  { x: 0.50, size: 18, duration: 6800, delay: 2200, opacity: 0.15, driftAmp: 12 },
  { x: 0.63, size: 24, duration: 9600, delay: 900,  opacity: 0.17, driftAmp: 16 },
  { x: 0.76, size: 16, duration: 7600, delay: 3100, opacity: 0.12, driftAmp: 9  },
  { x: 0.88, size: 28, duration: 8400, delay: 1800, opacity: 0.19, driftAmp: 20 },
  { x: 0.14, size: 20, duration: 10200,delay: 4000, opacity: 0.14, driftAmp: 13 },
  { x: 0.44, size: 12, duration: 7000, delay: 2800, opacity: 0.11, driftAmp: 8  },
  { x: 0.92, size: 18, duration: 8800, delay: 500,  opacity: 0.16, driftAmp: 11 },
];

const FloatingBoba: React.FC<BobaConfig> = ({
  x, size, duration, delay, opacity, driftAmp,
}) => {
  const riseAnim  = useRef(new Animated.Value(0)).current;
  const driftAnim = useRef(new Animated.Value(0)).current;

  const startRise = () => {
    riseAnim.setValue(0);
    Animated.timing(riseAnim, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) startRise();
    });
  };

  const startDrift = () => {
    Animated.sequence([
      Animated.timing(driftAnim, { toValue: 1, duration: duration * 0.52, useNativeDriver: true }),
      Animated.timing(driftAnim, { toValue: 0, duration: duration * 0.48, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) startDrift();
    });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      startRise();
      startDrift();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  const translateY = riseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SH + size, -size * 2],
  });

  const translateX = driftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-driftAmp, driftAmp],
  });

  const scale = riseAnim.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.Image
      source={IMAGES.ball}
      style={[
        styles.boba,
        {
          width: size,
          height: size,
          left: SW * x - size / 2,
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        },
      ]}
      resizeMode="contain"
    />
  );
};

export const FloatingBobas: React.FC = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {BOBAS.map((cfg, i) => (
      <FloatingBoba key={i} {...cfg} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  boba: {
    position: 'absolute',
    bottom: 0,
  },
});
