import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Switch,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  visible: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  onClose: () => void;
  onUpdateSettings: (sound: boolean, haptics: boolean) => void;
}

export const SettingsModal: React.FC<Props> = ({
  visible,
  soundEnabled,
  hapticsEnabled,
  onClose,
  onUpdateSettings,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, speed: 16, bounciness: 8, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const toggleSound = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdateSettings(!soundEnabled, hapticsEnabled);
  };

  const toggleHaptics = () => {
    // Always fire one last haptic when turning off
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdateSettings(soundEnabled, !hapticsEnabled);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
        >
          <TouchableOpacity activeOpacity={1}>
            <LinearGradient
              colors={['#FFF8F0', '#FFF1DC']}
              style={StyleSheet.absoluteFill}
            />

            {/* Handle */}
            <View style={styles.handle} />

            {/* Title */}
            <Text style={styles.title}>Settings</Text>

            {/* ── Toggles ── */}
            <View style={styles.section}>
              <SettingsRow
                label="Sound Effects"
                emoji="🔊"
                value={soundEnabled}
                onToggle={toggleSound}
              />
              <View style={styles.divider} />
              <SettingsRow
                label="Haptics"
                emoji="📳"
                value={hapticsEnabled}
                onToggle={toggleHaptics}
              />
            </View>

            {/* ── Credits ── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>About</Text>
              <TouchableOpacity
                style={styles.creditRow}
                onPress={() => Linking.openURL('https://codewerx.com')}
                activeOpacity={0.7}
              >
                <Text style={styles.creditText}>Made with ☕ by CODEWERX LLC</Text>
                <Text style={styles.creditArrow}>›</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <View style={styles.creditRow}>
                <Text style={styles.creditText}>Version 1.0.0</Text>
              </View>
            </View>

            {/* ── Close ── */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#8B4513', '#5C2E00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

interface RowProps {
  label: string;
  emoji: string;
  value: boolean;
  onToggle: () => void;
}

const SettingsRow: React.FC<RowProps> = ({ label, emoji, value, onToggle }) => (
  <View style={styles.row}>
    <Text style={styles.rowEmoji}>{emoji}</Text>
    <Text style={styles.rowLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: '#D4BFA0', true: '#8B4513' }}
      thumbColor="#FFF"
      ios_backgroundColor="#D4BFA0"
    />
  </View>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 40,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#3B1A08',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(180,120,60,0.2)',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B6030',
    letterSpacing: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  rowEmoji: {
    fontSize: 22,
  },
  rowLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#3B1A08',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(180,120,60,0.15)',
    marginHorizontal: 18,
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  creditText: {
    flex: 1,
    fontSize: 15,
    color: '#5C3010',
    fontWeight: '500',
  },
  creditArrow: {
    fontSize: 20,
    color: '#8B6030',
  },
  closeBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    overflow: 'hidden',
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
});
