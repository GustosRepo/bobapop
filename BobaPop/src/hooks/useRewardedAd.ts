import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  useRewardedAd as useAdMobRewardedAd,
  TestIds,
} from 'react-native-google-mobile-ads';

const FALLBACK_REWARDED_UNIT_ID = 'ca-app-pub-8863066373093222/9842491767';
const USE_TEST_ADS = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true';
const REWARDED_UNIT_ID = USE_TEST_ADS
  ? TestIds.REWARDED
  : Platform.select({
      ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID,
      android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID,
      default: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID,
    }) || FALLBACK_REWARDED_UNIT_ID;

const REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };
export type RewardedAdResult = 'watched' | 'not_available' | 'skipped' | 'closed' | 'timeout' | 'error';
const AD_RESULT_TIMEOUT_MS = 90_000;

export function useRewardedAd() {
  const [initialized, setInitialized] = useState(false);
  const { isLoaded, isEarnedReward, isClosed, load, show } = useAdMobRewardedAd(
    REWARDED_UNIT_ID,
    REQUEST_OPTIONS,
  );

  // Initialize once before requesting ads.
  useEffect(() => {
    let cancelled = false;
    mobileAds()
      .initialize()
      .then(() => {
        if (cancelled) return;
        setInitialized(true);
        load();
      })
      .catch(() => {
        if (!cancelled) setInitialized(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Reload after it closes so it's ready for next game over
  useEffect(() => {
    if (initialized && isClosed) load();
  }, [initialized, isClosed, load]);

  // Pending reward callback — fired when isEarnedReward flips true
  const pendingReward = useRef<((result: RewardedAdResult) => void) | null>(null);
  const rewardEarnedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAdTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const settleReward = useCallback((result: RewardedAdResult) => {
    if (!pendingReward.current) return;
    clearAdTimeout();
    const callback = pendingReward.current;
    pendingReward.current = null;
    callback(result);
  }, [clearAdTimeout]);

  useEffect(() => {
    if (isEarnedReward && pendingReward.current) {
      rewardEarnedRef.current = true;
      settleReward('watched');
    }
  }, [isEarnedReward, settleReward]);

  useEffect(() => {
    if (!isClosed) return;
    if (!rewardEarnedRef.current && pendingReward.current) {
      settleReward('closed');
    }
    rewardEarnedRef.current = false;
  }, [isClosed, settleReward]);

  useEffect(() => clearAdTimeout, [clearAdTimeout]);

  /**
   * Show the rewarded ad. Rewards are granted only after the ad SDK reports
   * an earned reward.
   */
  const showAd = useCallback(
    (onResult: (result: RewardedAdResult) => void) => {
      if (!initialized || !isLoaded) {
        onResult('not_available');
        if (initialized) load();
        return;
      }
      if (pendingReward.current) {
        onResult('error');
        return;
      }
      pendingReward.current = onResult;
      rewardEarnedRef.current = false;
      timeoutRef.current = setTimeout(() => {
        settleReward('timeout');
        load();
      }, AD_RESULT_TIMEOUT_MS);
      try {
        show();
      } catch {
        settleReward('error');
        load();
      }
    },
    [isLoaded, load, settleReward, show],
  );

  return { isLoaded, showAd };
}
