import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// react-native-google-mobile-ads is a native module — not available in Expo Go.
// Gracefully disable ads instead of crashing when the module is missing.
let mobileAds: typeof import('react-native-google-mobile-ads').default;
let useAdMobRewardedAd: typeof import('react-native-google-mobile-ads').useRewardedAd;
let TestIds: typeof import('react-native-google-mobile-ads').TestIds;
let nativeModuleAvailable = false;
try {
  const adsModule = require('react-native-google-mobile-ads');
  mobileAds = adsModule.default;
  useAdMobRewardedAd = adsModule.useRewardedAd;
  TestIds = adsModule.TestIds;
  nativeModuleAvailable = true;
} catch {
  // Running in Expo Go or an environment without the native module.
}

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

  console.warn(`[ads] Missing valid ${Platform.OS} rewarded ad unit ID. Rewarded ads will stay disabled.`);
  return null;
}

const REWARDED_UNIT_ID = nativeModuleAvailable ? resolveRewardedUnitId() : null;
const ADS_CONFIGURED = REWARDED_UNIT_ID !== null;

const REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };
export type RewardedAdResult = 'watched' | 'not_available' | 'skipped' | 'closed' | 'timeout' | 'error';
export type RewardedAdStatus = 'loading' | 'ready' | 'unavailable';
const AD_RESULT_TIMEOUT_MS = 90_000;
const LOAD_RETRY_DELAYS_MS = [1_000, 3_000, 8_000, 15_000, 30_000];
const LOAD_GIVE_UP_MS = 15_000;

export function useRewardedAd() {
  const [initialized, setInitialized] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const [loadRetryAttempt, setLoadRetryAttempt] = useState(0);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const loadGiveUpTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stubAdHook = { isLoaded: false, isEarnedReward: false, isClosed: false, error: null as Error | null, load: () => {}, show: () => {} };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const adHook = nativeModuleAvailable ? useAdMobRewardedAd(REWARDED_UNIT_ID ?? TestIds.REWARDED, REQUEST_OPTIONS) : stubAdHook;
  const { isLoaded, isEarnedReward, isClosed, error, load, show } = adHook;
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
        setLoadTimedOut(false);
        loadGiveUpTimeout.current = setTimeout(() => {
          loadGiveUpTimeout.current = null;
          setLoadTimedOut(true);
        }, LOAD_GIVE_UP_MS);
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
      if (loadGiveUpTimeout.current) {
        clearTimeout(loadGiveUpTimeout.current);
        loadGiveUpTimeout.current = null;
      }
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
    setLoadTimedOut(false);
    if (loadGiveUpTimeout.current) {
      clearTimeout(loadGiveUpTimeout.current);
      loadGiveUpTimeout.current = null;
    }
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

  const status: RewardedAdStatus = !ADS_CONFIGURED || initFailed || loadTimedOut
    ? 'unavailable'
    : isLoaded
    ? 'ready'
    : 'loading';

  return { isLoaded: status === 'ready', status, showAd };
}
