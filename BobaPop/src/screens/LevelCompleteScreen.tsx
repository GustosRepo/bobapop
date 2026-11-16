import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { LinearGradient } from 'expo-linear-gradient';
import { WorldTheme } from '../constants/themes';
import { IMAGES } from '../assets/images';
import { RewardedOfferButton } from '../components/RewardedOfferButton';
import { getEnergyAdReward } from '../monetization/economy';
import type { RewardedAdStatus } from '../hooks/useRewardedAd';

interface Props {
  score: number;
  firstClear: boolean;
  badgeUnlocks: string[];
  energyRefund: number;
  unlimitedEnergy: boolean;
  bobasEarned: number;
  bonusAvailable: boolean;
  bonusAdStatus: RewardedAdStatus;
  onClaimBonus: () => void;
  energy: number;
  maxEnergy: number;
  energyAdReady: boolean;
  energyAdLoading: boolean;
  onWatchEnergyAd: () => void;
  stars: number;
  levelNumber: number;
  theme: WorldTheme;
  isLast: boolean;
  isWorldBoss: boolean;
  chapter: number;
  isChapterComplete: boolean;
  onNext: () => void;
  onReplay: () => void;
  onMenu: () => void;
}


export const LevelCompleteScreen: React.FC<Props> = ({
  score,
  firstClear,
  badgeUnlocks,
  energyRefund,
  unlimitedEnergy,
  bobasEarned,
  bonusAvailable,
  bonusAdStatus,
  onClaimBonus,
  energy,
  maxEnergy,
  energyAdReady,
  energyAdLoading,
  onWatchEnergyAd,
  stars,
  levelNumber,
  theme,
  isLast,
  isWorldBoss,
  chapter,
  isChapterComplete,
  onNext,
  onReplay,
  onMenu,
}) => {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const title = isLast
    ? 'All Worlds Cleared!'
    : isChapterComplete
    ? `Chapter ${chapter} Cleared!`
    : isWorldBoss
    ? 'Boss Defeated!'
    : 'Level Complete!';

  // ── Star pop-in animation ───────────────────────────────────────────────
  const starAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    if (reducedMotion) { starAnims.forEach((anim) => anim.setValue(1)); return; }
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
  }, [reducedMotion]);

  return (
    <LinearGradient colors={theme.background as [string, string, string]} style={styles.root}>
      <StatusBar hidden />
      <ScrollView style={{ width: '100%' }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}>
        <Image
          source={
            stars === 3
              ? IMAGES.mascotVictory  // Big laugh for perfect clear
              : isWorldBoss
              ? IMAGES.mascotExcited  // Star eyes for boss defeat
              : IMAGES.mascotHappy    // Gentle smile otherwise
          }
          style={styles.mascot}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: theme.ballColor }]}>{title}</Text>
        {isWorldBoss && (
          <View style={[styles.bossTag, { backgroundColor: theme.accentColor + '33', borderColor: theme.accentColor }]}>
            <Image source={IMAGES.boss} style={styles.bossTagIcon} resizeMode="contain" />
            <Text style={styles.bossTagText}>Boss Defeated!</Text>
          </View>
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

        {firstClear && <View style={styles.clearReward} accessibilityLiveRegion="polite">
          <Text style={styles.clearRewardText}>{energyRefund > 0 ? `First clear! +${energyRefund} Energy returned` : unlimitedEnergy ? 'First clear! Your Energy stays unlimited.' : 'First clear!'}</Text>
        </View>}
        {badgeUnlocks.map((name) => <Text key={name} style={styles.clearRewardText} accessibilityLiveRegion="polite">{name} badge unlocked! Equip it in your profile.</Text>)}
        <Text style={styles.rewardHint}>Stars advance your rank. Bobas from this clear unlock badge styles.</Text>
        <Text style={styles.clearRewardText}>{`+${bobasEarned} Bobas earned`}</Text>

        <View style={styles.buttons}>
          {!isLast && (
            <TouchableOpacity accessibilityRole="button"
              style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.paddleColor }]}
              onPress={onNext}
            >
              <Text style={styles.btnTextPrimary}>
                {isChapterComplete ? 'Next Chapter →' : isWorldBoss ? 'Next World →' : 'Next Level →'}
              </Text>
            </TouchableOpacity>
          )}
          {bonusAvailable && (
            <RewardedOfferButton
              title={unlimitedEnergy ? `Claim · +${bobasEarned} Bonus Bobas` : `Watch Ad · +${bobasEarned} Bonus Bobas`}
              detail={unlimitedEnergy ? 'Double your clear Bobas · Included with Plus' : 'Double your clear Bobas · Unlock badge styles sooner'}
              ready={unlimitedEnergy || bonusAdStatus === 'ready'} loading={!unlimitedEnergy && bonusAdStatus === 'loading'}
              onPress={onClaimBonus} />
          )}
          {!unlimitedEnergy && energy < maxEnergy && (
            <RewardedOfferButton title={`Watch Ad · +${getEnergyAdReward(energy, maxEnergy)} Energy`}
              detail={`Energy ${energy}/${maxEnergy} · Stock up for your next run`}
              ready={energyAdReady} loading={energyAdLoading} onPress={onWatchEnergyAd} />
          )}
          <TouchableOpacity accessibilityRole="button"
            style={[styles.btn, { borderColor: theme.accentColor, borderWidth: 1.5 }]}
            onPress={onReplay}
          >
            <Text style={[styles.btnTextSecondary, { color: theme.accentColor }]}>Replay</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.menuBtn} onPress={onMenu}>
            <Text style={[styles.menuText, { color: theme.accentColor }]}>← Levels</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  clearReward: { padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  clearRewardText: { color: '#FFF5DD', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  rewardHint: { color: '#FFF5DD', fontSize: 13, textAlign: 'center', opacity: 0.85 },
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
    width: '100%',
    flexGrow: 1,
    justifyContent: 'center',
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
    maxWidth: 440,
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
    maxWidth: 440,
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
  bossTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  bossTagIcon: {
    width: 22,
    height: 22,
  },
  bossTagText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
