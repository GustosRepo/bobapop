import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { WorldTheme } from '../constants/themes';
import { IMAGES } from '../assets/images';
import { getEnergyAdReward } from '../monetization/economy';
import { RewardedOfferButton } from '../components/RewardedOfferButton';
import { ContinueOffer } from '../monetization/continueSystem';

interface Props {
  score: number;
  levelNumber: number;
  theme: WorldTheme;
  adsRemoved: boolean;
  continueOffer: ContinueOffer;
  adAvailable: boolean;
  adUnavailable: boolean;
  energyAdReady: boolean;
  energyAdLoading: boolean;
  energy: number;
  maxEnergy: number;
  nextEnergyInMs: number;
  onContinue: () => void;
  onWatchEnergyAd: () => void;
  onRetry: () => void;
  onMenu: () => void;
  onOpenPlus: () => void;
}


export const GameOverScreen: React.FC<Props> = ({
  score,
  levelNumber,
  theme,
  adsRemoved,
  continueOffer,
  adAvailable,
  adUnavailable,
  energyAdReady,
  energyAdLoading,
  energy,
  maxEnergy,
  nextEnergyInMs,
  onContinue,
  onWatchEnergyAd,
  onRetry,
  onMenu,
  onOpenPlus,
}) => {
  const insets = useSafeAreaInsets();
  const hasContinue = continueOffer.canShow;
  const canRetryFresh = adsRemoved || energy > 0;
  const nextEnergyMinutes = Math.ceil(nextEnergyInMs / 60000);
  const waitingForAd = hasContinue && !adsRemoved && !adAvailable && !adUnavailable;
  const canPressContinue = hasContinue && !waitingForAd && !adUnavailable;
  const continueButtonText = adUnavailable
    ? 'Ad unavailable'
    : waitingForAd
    ? 'Ad loading...'
    : continueOffer.buttonText;
  const continueSubText = hasContinue
    ? adUnavailable
      ? 'Retry or try again later.'
      : continueOffer.subtitle
    : continueOffer.subtitle;

  return (
    <LinearGradient colors={['#0A0A0A', '#1A0A0A', '#2A0A0A']} style={styles.root}>
      <StatusBar hidden />
      <ScrollView style={{ width: '100%' }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}>
        <Image source={IMAGES.mascotSad} style={styles.mascot} resizeMode="contain" />
        <Text style={styles.title}>Boba break!</Text>
        <Text style={[styles.levelText, { color: theme.accentColor }]}>
          Level {levelNumber}
        </Text>

        <View style={[styles.scoreCard, { backgroundColor: theme.accentColor + '15', borderColor: theme.accentColor + '55' }]}>
          <Text style={[styles.scoreLabel, { color: theme.accentColor }]}>Score</Text>
          <Text style={styles.scoreValue}>{score.toLocaleString()}</Text>
        </View>

        <View style={styles.buttons}>
          {hasContinue && (
            <TouchableOpacity accessibilityRole="button"
              style={[styles.continueBtn, !canPressContinue && styles.continueBtnDisabled]}
              onPress={onContinue}
              disabled={!canPressContinue}
              activeOpacity={0.85}
            >
              <Image source={IMAGES.lifeIcon} style={styles.continueIcon} resizeMode="contain" />
              <View>
                <Text style={styles.continueBtnTitle}>{continueButtonText}</Text>
                <Text style={styles.continueBtnSub}>{continueSubText}</Text>
              </View>
            </TouchableOpacity>
          )}
          {!hasContinue && (
            <View style={[styles.messageCard, { borderColor: theme.accentColor + '55' }]}>
              <Text style={styles.messageTitle}>{continueOffer.title}</Text>
              <Text style={styles.messageText}>{continueOffer.subtitle}</Text>
            </View>
          )}
          <TouchableOpacity accessibilityRole="button"
            style={[
              styles.btn,
              canRetryFresh ? undefined : styles.continueBtnDisabled,
              { backgroundColor: theme.paddleColor },
            ]}
            onPress={onRetry}
            disabled={!canRetryFresh}
          >
            <Text style={styles.btnText}>
              {adsRemoved ? 'Retry Level · Unlimited Energy' : canRetryFresh
                ? `Retry Level - Energy ${energy}/${maxEnergy}`
                : `Next energy in ${nextEnergyMinutes}m`}
            </Text>
          </TouchableOpacity>
          {energy < maxEnergy && !adsRemoved && (
            <RewardedOfferButton title={`Watch Ad · +${getEnergyAdReward(energy, maxEnergy)} Energy`}
              detail={`Energy ${energy}/${maxEnergy} · ${canRetryFresh ? 'Stock up for another run' : 'Refill to start a fresh run'}`}
              ready={energyAdReady} loading={energyAdLoading} onPress={onWatchEnergyAd} />
          )}
          <TouchableOpacity accessibilityRole="button"
            style={[styles.btn, styles.btnOutline, { borderColor: theme.accentColor }]}
            onPress={onMenu}
          >
            <Text style={[styles.btnTextOutline, { color: theme.accentColor }]}>Levels</Text>
          </TouchableOpacity>
          {!adsRemoved && levelNumber >= 6 && (
            <TouchableOpacity accessibilityRole="button" style={styles.plusPrompt} onPress={onOpenPlus} activeOpacity={0.82}>
              <Image source={IMAGES.mascotHappy} style={styles.plusIcon} resizeMode="contain" />
              <View style={styles.plusTextWrap}>
                <Text style={styles.plusTitle}>Try BobaPop Plus</Text>
                <Text style={styles.plusText}>Unlimited Energy and ad-free continues.</Text>
              </View>
              <Text style={styles.plusArrow}>›</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
    width: '100%',
    flexGrow: 1,
    justifyContent: 'center',
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
    maxWidth: 440,
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
    maxWidth: 440,
    gap: 12,
    marginTop: 8,
  },
  continueBtn: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#F5A623',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  continueBtnDisabled: {
    opacity: 0.55,
  },
  continueIcon: {
    width: 32,
    height: 32,
  },
  continueBtnTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  continueBtnSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  messageCard: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  messageTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  messageText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
    lineHeight: 18,
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
  plusPrompt: {
    marginTop: 2,
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  plusIcon: {
    width: 34,
    height: 34,
  },
  plusTextWrap: {
    flex: 1,
  },
  plusTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  plusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  plusArrow: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
  },
});
