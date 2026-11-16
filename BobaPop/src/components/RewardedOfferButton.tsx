import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

interface Props {
  title: string;
  detail: string;
  ready: boolean;
  loading: boolean;
  onPress: () => void;
}

export function RewardedOfferButton({ title, detail, ready, loading, onPress }: Props) {
  if (!ready && !loading) return null;
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${title}. ${loading ? 'Ad loading.' : detail}`}
      accessibilityState={{ disabled: !ready, busy: loading }} disabled={!ready} onPress={onPress}
      style={[styles.button, !ready && styles.disabled]} activeOpacity={0.85}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{loading ? 'Ad loading…' : detail}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: '100%', maxWidth: 440, borderRadius: 16, borderWidth: 1.5, borderColor: '#E6B86A',
    backgroundColor: '#54280C', paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', gap: 4, minHeight: 64 },
  disabled: { opacity: 0.6 },
  title: { color: '#FFF4D6', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  detail: { color: '#F4D3A4', fontSize: 13, textAlign: 'center' },
});
