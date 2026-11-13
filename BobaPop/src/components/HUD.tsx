import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { IMAGES } from '../assets/images';
import { ActivePowerUp, BossBrick } from '../game/types';
import { WorldTheme } from '../constants/themes';

interface Props {
  score: number;
  lives: number;
  level: number;
  levelName?: string;
  worldName: string;
  activePowerUps: ActivePowerUp[];
  theme: WorldTheme;
  boss?: Pick<BossBrick, 'hp' | 'maxHp' | 'enraged'> | null;
  compact?: boolean;
  stacked?: boolean;
  onPause: () => void;
}

const POWERUP_IMAGES = {
  multi_ball: IMAGES.ballMulti,
  wide_paddle: IMAGES.paddleWide,
  sticky_paddle: IMAGES.paddleSticky,
  slow_motion: IMAGES.ballHot,
};

export const HUD: React.FC<Props> = ({
  score,
  lives,
  level,
  levelName,
  worldName,
  activePowerUps,
  theme,
  boss,
  compact = false,
  stacked = false,
  onPause,
}) => {

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View style={[styles.topRow, stacked && { flexDirection: 'column', gap: 16 }]}>
        <View style={{ flex: stacked ? undefined : 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[styles.worldName, { color: theme.accentColor }]}>{worldName}</Text>
          <Text style={[styles.levelText, compact && { fontSize: 16 }, { color: theme.ballColor }]}>Level {level}</Text>
          {!compact && levelName && <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: theme.ballColor }}>{levelName}</Text>}
        </View>
        <View style={[styles.scoreBlock, stacked && { flex: 0 }]}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.score, compact && { fontSize: 18 }, { color: theme.ballColor }]}>{score.toLocaleString()}</Text>
        </View>
        <View style={styles.rightBlock}>
          <View style={styles.livesRow}>
            <Image source={IMAGES.lifeIcon} style={styles.lifeIcon} resizeMode="contain" />
            <Text accessibilityLabel={`${lives} lives`} style={{ color: theme.ballColor, fontSize: compact ? 16 : 18, fontWeight: '800' }}>×{lives}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pause game" onPress={onPause} style={styles.pauseBtn}>
              <Image source={IMAGES.pauseBtn} style={styles.pauseIcon} resizeMode="contain" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Boss HP bar — only shown on boss levels */}
      {boss && boss.hp > 0 && (
        <View style={styles.bossBarWrapper}>
          <View style={styles.bossBarRow}>
            <Text style={[styles.bossLabel, { color: boss.enraged ? '#FF4444' : '#FF8C69' }]}>
              {boss.enraged ? 'ENRAGED' : 'BOSS'}
            </Text>
            <Text style={[styles.bossHpText, { color: boss.enraged ? '#FF4444' : '#FF8C69' }]}>
              {boss.hp}/{boss.maxHp}
            </Text>
          </View>
          {/* Flex-based bar — no absolute positioning so it never escapes its container */}
          <View style={styles.bossBarTrack}>
            <View
              style={[
                styles.bossBarFill,
                {
                  flex: boss.hp,
                  backgroundColor: boss.enraged ? '#FF4444' : '#FF8C69',
                },
              ]}
            />
            <View style={{ flex: Math.max(0, boss.maxHp - boss.hp) }} />
          </View>
        </View>
      )}

      {/* Always reserve space for power-ups row */}
      <View style={styles.powerUpsRow}>
        {activePowerUps.map((p) => {
          return (
            <View key={p.type} style={[styles.powerUpTag, { borderColor: theme.accentColor }]}>
              <Image source={POWERUP_IMAGES[p.type]} style={styles.powerUpIcon} resizeMode="contain" />
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  compactContainer: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  worldName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  levelText: {
    fontSize: 20,
    fontWeight: '700',
  },
  scoreBlock: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  score: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  rightBlock: {
    alignItems: 'flex-end',
  },
  livesRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  lifeIcon: {
    width: 28,
    height: 28,
  },
  pauseBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  pauseIcon: {
    width: 36,
    height: 36,
  },
  powerUpsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    minHeight: 24,
    justifyContent: 'center',
  },
  powerUpTag: {
    borderWidth: 1,
    borderRadius: 8,
    width: 42,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerUpIcon: {
    width: 32,
    height: 18,
  },
  bossBarWrapper: {
    marginTop: 6,
    gap: 3,
  },
  bossBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bossLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  bossBarTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  bossBarFill: {
    borderRadius: 5,
  },
  bossHpText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
