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
  const scoreText = score.toLocaleString();
  const containerStyle = stacked
    ? [styles.panel, { backgroundColor: theme.background[0], borderColor: `${theme.accentColor}66` }]
    : [styles.container, compact && styles.compactContainer];

  return (
    <View style={containerStyle} pointerEvents="box-none">
      <View style={stacked ? styles.panelStats : styles.topRow} pointerEvents="box-none">
        <View style={!stacked && [styles.levelBlock, compact && styles.compactLevelBlock]}>
          <Text numberOfLines={1} style={[styles.worldName, compact && styles.compactWorldName, { color: theme.ballColor }]}>{worldName}</Text>
          <Text numberOfLines={1} style={[styles.levelText, compact && !stacked && styles.compactLevelText, { color: theme.ballColor }]}>Level {level}</Text>
          {(stacked || !compact) && levelName && <Text numberOfLines={1} style={[styles.levelName, { color: theme.ballColor }]}>{levelName}</Text>}
        </View>
        <View style={stacked ? styles.panelScoreBlock : [styles.scoreBlock, compact && styles.compactScoreBlock]} accessible accessibilityLabel={`Score ${scoreText}`}>
          {stacked && <Text style={styles.scoreLabel}>Score</Text>}
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.score, compact && styles.compactScore, stacked && styles.panelScore, { color: theme.ballColor }]}>{scoreText}</Text>
        </View>
        <View style={[styles.livesRow, stacked && styles.panelLivesRow]} pointerEvents="box-none">
          <View style={styles.livesRow} accessible accessibilityLabel={`${lives} lives`}>
            <Image source={IMAGES.lifeIcon} style={styles.lifeIcon} resizeMode="contain" />
            <Text style={{ color: theme.ballColor, fontSize: compact ? 16 : 18, fontWeight: '800' }}>×{lives}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pause game" onPress={onPause}
            style={[styles.pauseBtn, stacked && [styles.panelPauseBtn, { backgroundColor: `${theme.accentColor}26` }]]}>
            <Image source={IMAGES.pauseBtn} style={styles.pauseIcon} resizeMode="contain" />
          </TouchableOpacity>
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

      {(!stacked || activePowerUps.length > 0) && <View style={[styles.powerUpsRow, stacked && styles.panelPowerUpsRow]}>
        {activePowerUps.map((p) => {
          return (
            <View key={p.type} style={[styles.powerUpTag, { borderColor: theme.accentColor }]}>
              <Image source={POWERUP_IMAGES[p.type]} style={styles.powerUpIcon} resizeMode="contain" />
            </View>
          );
        })}
      </View>}
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
  panel: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  panelStats: { gap: 10 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelBlock: { flex: 1, minWidth: 0 },
  compactLevelBlock: { flex: 1.55 },
  worldName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  compactWorldName: { letterSpacing: 0.5 },
  levelText: {
    fontSize: 20,
    fontWeight: '700',
  },
  compactLevelText: { fontSize: 16 },
  levelName: { fontSize: 11, fontWeight: '700' },
  scoreBlock: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  compactScoreBlock: { flex: 0.65, paddingHorizontal: 4 },
  score: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  compactScore: { fontSize: 18 },
  panelScoreBlock: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.13)',
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.73)',
    fontSize: 12,
    fontWeight: '600',
  },
  panelScore: {
    fontSize: 30,
    letterSpacing: 0,
  },
  livesRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  panelLivesRow: { justifyContent: 'space-between', gap: 4 },
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
  panelPauseBtn: { marginLeft: 0, borderRadius: 12 },
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
  panelPowerUpsRow: { flexWrap: 'wrap', justifyContent: 'flex-start', gap: 5 },
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
