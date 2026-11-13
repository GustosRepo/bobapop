import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BADGE_STYLES, BadgeStyleId, isBadgeUnlocked } from '../game/badgeRewards';

interface Props {
  stars: number;
  bobas: number;
  selectedId: BadgeStyleId;
  onSelect: (id: BadgeStyleId) => void;
}

export function BadgeRewards({ stars, bobas, selectedId, onSelect }: Props) {
  return <View style={styles.section}>
    <Text style={styles.title}>Badge styles</Text>
    <Text style={styles.description}>Earn stars and bank bobas by clearing levels. Unlock styles, then tap to equip. Your bobas are never spent.</Text>
    <View style={styles.grid}>
      {BADGE_STYLES.map((badge) => {
        const unlocked = isBadgeUnlocked(badge, stars, bobas);
        const selected = unlocked && badge.id === selectedId;
        const requirement = badge.stars ? `${badge.stars} Stars` : `${badge.bobas} Bobas`;
        return <TouchableOpacity key={badge.id} accessibilityRole="button"
          accessibilityLabel={`${badge.name} badge, ${selected ? 'equipped' : unlocked ? 'tap to equip' : `locked, earn ${requirement}`}`}
          accessibilityState={{ selected, disabled: !unlocked }} disabled={!unlocked}
          onPress={() => onSelect(badge.id)}
          style={[styles.badge, { borderColor: selected ? '#3B1A08' : 'transparent', opacity: unlocked ? 1 : 0.65 }]}>
          <LinearGradient colors={badge.colors} style={StyleSheet.absoluteFill} />
          <Text style={[styles.name, { color: badge.foreground }]}>{badge.name}</Text>
          <Text style={[styles.state, { color: badge.foreground }]}>{selected ? 'Equipped' : unlocked ? 'Tap to equip' : requirement}</Text>
        </TouchableOpacity>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { width: '100%', marginTop: 20, gap: 8 },
  title: { color: '#4E240A', fontSize: 19, fontWeight: '900' },
  description: { color: '#65452E', fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '47%', minHeight: 72, borderWidth: 3, borderRadius: 14, overflow: 'hidden', padding: 9, justifyContent: 'center' },
  name: { fontWeight: '900', fontSize: 15 },
  state: { fontWeight: '700', fontSize: 11, marginTop: 4 },
});
