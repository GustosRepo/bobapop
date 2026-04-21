import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { IMAGES } from '../assets/images';
import { ActivePowerUp, BossBrick } from '../game/types';
import { WorldTheme } from '../constants/themes';

interface Props {
  score: number;
  lives: number;
  level: number;
  worldName: string;
  activePowerUps: ActivePowerUp[];
  theme: WorldTheme;
  boss?: Pick<BossBrick, 'hp' | 'maxHp' | 'enraged'> | null;
  onPause: () => void;
}

const POWERUP_ICONS: Record<string, string> = {
  multi_ball: '⚪⚪',
  wide_paddle: '━━━',
  sticky_paddle: '🍯',
  slow_motion: '🐢',
};

export const HUD: React.FC<Props> = ({
  score,
  lives,
  level,
  worldName,
  activePowerUps,
  theme,
  boss,
  onPause,
}) => {
  const now = Date.now();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.worldName, { color: theme.accentColor }]}>{worldName}</Text>
          <Text style={[styles.levelText, { color: theme.ballColor }]}>Level {level}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={[styles.score, { color: theme.ballColor }]}>{score.toLocaleString()}</Text>
        </View>
        <View style={styles.rightBlock}>
          <Text style={styles.livesText}>{'🧋'.repeat(lives)}</Text>
          <TouchableOpacity onPress={onPause} style={styles.pauseBtn}>
            <Image source={IMAGES.pauseBtn} style={styles.pauseIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Boss HP bar — only shown on boss levels */}
      {boss && boss.hp > 0 && (
        <View style={styles.bossBarWrapper}>
          <View style={styles.bossBarRow}>
            <Text style={[styles.bossLabel, { color: boss.enraged ? '#FF4444' : '#FF8C69' }]}>
              {boss.enraged ? '💢 ENRAGED' : '👾 BOSS'}
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
              <Text style={styles.powerUpIcon}>{POWERUP_ICONS[p.type] ?? '✨'}</Text>
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
    alignItems: 'center',
  },
  score: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  rightBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  livesText: {
    fontSize: 16,
  },
  pauseBtn: {
    padding: 4,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  powerUpIcon: {
    fontSize: 12,
    color: '#fff',
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
