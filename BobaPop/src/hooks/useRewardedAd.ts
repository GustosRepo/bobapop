import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  useRewardedAd as useAdMobRewardedAd,
  TestIds,
} from 'react-native-google-mobile-ads';

const FALLBACK_ANDROID_REWARDED_UNIT_ID = 'ca-app-pub-8863066373093222/9842491767';
const ALLOW_RELEASE_TEST_ADS = process.env.EXPO_PUBLIC_ALLOW_TEST_ADS_IN_RELEASE === 'true';
const USE_TEST_ADS = __DEV__ || (
  ALLOW_RELEASE_TEST_ADS && process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true'
);

function isAdUnitId(value: string | undefined): value is string {
  return /^ca-app-pub-\d+\/\d+$/.test(value ?? '');
}

function resolveRewardedUnitId() {
  if (USE_TEST_ADS) return TestIds.REWARDED;

  const configuredUnitId = Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID,
    android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID,
    default: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID,
  });

  if (isAdUnitId(configuredUnitId)) return configuredUnitId;

  if (configuredUnitId) {
    console.warn(
      `[ads] Ignoring invalid rewarded ad unit ID for ${Platform.OS}. ` +
        'Rewarded ad unit IDs must use ca-app-pub-.../... format.',
    );
  }

  if (Platform.OS === 'android') return FALLBACK_ANDROID_REWARDED_UNIT_ID;

  console.warn('[ads] Missing valid iOS rewarded ad unit ID. Rewarded ads will stay disabled.');
  return null;
}

const REWARDED_UNIT_ID = resolveRewardedUnitId();
const ADS_CONFIGURED = REWARDED_UNIT_ID !== null;

const REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };
export type RewardedAdResult = 'watched' | 'not_available' | 'skipped' | 'closed' | 'timeout' | 'error';
export type RewardedAdStatus = 'loading' | 'ready' | 'unavailable';
const AD_RESULT_TIMEOUT_MS = 90_000;
const LOAD_RETRY_DELAYS_MS = [1_000, 3_000, 8_000, 15_000, 30_000];

export function useRewardedAd() {
  const [initialized, setInitialized] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const [loadRetryAttempt, setLoadRetryAttempt] = useState(0);
  const { isLoaded, isEarnedReward, isClosed, error, load, show } = useAdMobRewardedAd(
    REWARDED_UNIT_ID ?? TestIds.REWARDED,
    REQUEST_OPTIONS,
  );
  const loadRetryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize once before requesting ads.
  useEffect(() => {
    if (!ADS_CONFIGURED) return;
    let cancelled = false;
    mobileAds()
      .initialize()
      .then(() => {
        if (cancelled) return;
        setInitFailed(false);
        setInitialized(true);
        load();
      })
      .catch(() => {
        if (!cancelled) {
          setInitialized(false);
          setInitFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const clearLoadRetryTimeout = useCallback(() => {
    if (loadRetryTimeout.current) {
      clearTimeout(loadRetryTimeout.current);
      loadRetryTimeout.current = null;
    }
  }, []);

  // Reload after it closes so it's ready for next game over
  useEffect(() => {
    if (initialized && isClosed) load();
  }, [initialized, isClosed, load]);

  useEffect(() => {
    if (!error) return;
    console.warn(`[ads] Rewarded ad failed to load: ${error.message}`);
  }, [error]);

  useEffect(() => {
    if (!ADS_CONFIGURED || !initialized || !error || isLoaded) return;

    clearLoadRetryTimeout();
    const delay = LOAD_RETRY_DELAYS_MS[Math.min(loadRetryAttempt, LOAD_RETRY_DELAYS_MS.length - 1)];
    loadRetryTimeout.current = setTimeout(() => {
      loadRetryTimeout.current = null;
      setLoadRetryAttempt((attempt) => attempt + 1);
      load();
    }, delay);

    return clearLoadRetryTimeout;
  }, [clearLoadRetryTimeout, error, initialized, isLoaded, load, loadRetryAttempt]);

  useEffect(() => {
    if (!isLoaded) return;
    clearLoadRetryTimeout();
    setLoadRetryAttempt(0);
  }, [clearLoadRetryTimeout, isLoaded]);

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

  useEffect(() => {
    return () => {
      clearAdTimeout();
      clearLoadRetryTimeout();
    };
  }, [clearAdTimeout, clearLoadRetryTimeout]);

  /**
   * Show the rewarded ad. Rewards are granted only after the ad SDK reports
   * an earned reward.
   */
  const showAd = useCallback(
    (onResult: (result: RewardedAdResult) => void) => {
      if (!initialized || !isLoaded) {
        onResult('not_available');
        if (ADS_CONFIGURED && initialized) load();
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
        if (ADS_CONFIGURED) load();
      }, AD_RESULT_TIMEOUT_MS);
      try {
        show();
      } catch {
        settleReward('error');
        if (ADS_CONFIGURED) load();
      }
    },
    [initialized, isLoaded, load, settleReward, show],
  );

  const status: RewardedAdStatus = !ADS_CONFIGURED || initFailed
    ? 'unavailable'
    : isLoaded
    ? 'ready'
    : 'loading';

  return { isLoaded: status === 'ready', status, showAd };
}
