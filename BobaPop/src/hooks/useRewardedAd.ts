import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { getAdsSdk } from '../monetization/adsSdk';

export type RewardedAdResult = 'watched' | 'not_available' | 'skipped' | 'closed' | 'timeout' | 'error';
export type RewardedAdStatus = 'loading' | 'ready' | 'unavailable';
const RETRY_DELAYS = [1000, 3000, 8000, 15000, 30000];

function resolveUnitId() {
  const sdk = getAdsSdk();
  if (!sdk) return null;
  if (__DEV__ || (process.env.EXPO_PUBLIC_ALLOW_TEST_ADS_IN_RELEASE === 'true'
    && process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true')) return sdk.TestIds.REWARDED;
  const id = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID;
  return /^ca-app-pub-\d+\/\d+$/.test(id ?? '') ? id! : null;
}

export function useRewardedAd(enabled = true) {
  const [status, setStatus] = useState<RewardedAdStatus>('unavailable');
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const [revision, setRevision] = useState(0);
  const adRef = useRef<ReturnType<NonNullable<ReturnType<typeof getAdsSdk>>['RewardedAd']['createForAdRequest']> | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<((result: RewardedAdResult) => void) | null>(null);
  const earnedRef = useRef(false);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showingRef = useRef(false);

  const settle = useCallback((result: RewardedAdResult) => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = null;
    const callback = pendingRef.current;
    pendingRef.current = null;
    callback?.(result);
  }, []);

  useEffect(() => {
    let mounted = true;
    const sdk = getAdsSdk();
    sdk?.AdsConsent.getConsentInfo().then((info) => {
      if (mounted) setPrivacyOptionsRequired(info.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const sdk = getAdsSdk();
    const unitId = resolveUnitId();
    readyRef.current = false;
    if (!enabled || !sdk || !unitId) { setStatus('unavailable'); return; }
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    let attempt = 0;
    setStatus('loading');
    const updateConsent = (info: Awaited<ReturnType<typeof sdk.AdsConsent.getConsentInfo>>) => {
      if (!disposed) setPrivacyOptionsRequired(info.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
      return info.canRequestAds;
    };
    const start = async () => {
      let canRequest = false;
      try { canRequest = updateConsent(await sdk.AdsConsent.gatherConsent()); }
      catch { canRequest = updateConsent(await sdk.AdsConsent.getConsentInfo()); }
      if (disposed) return;
      if (!canRequest) { setStatus('unavailable'); return; }
      await sdk.default().initialize();
      if (disposed) return;
      const ad = sdk.RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });
      adRef.current = ad;
      const load = () => {
        if (disposed) return;
        clearTimeout(loadTimer);
        readyRef.current = false;
        setStatus('loading');
        loadTimer = setTimeout(() => { if (!disposed) setStatus('unavailable'); }, 15000);
        ad.load();
      };
      unsubscribe = ad.addAdEventsListener(({ type }) => {
        if (disposed) return;
        if (type === sdk.RewardedAdEventType.LOADED) {
          clearTimeout(loadTimer);
          attempt = 0;
          readyRef.current = true;
          setStatus('ready');
        } else if (type === sdk.RewardedAdEventType.EARNED_REWARD) {
          earnedRef.current = true;
        } else if (type === sdk.AdEventType.CLOSED) {
          showingRef.current = false;
          settle(earnedRef.current ? 'watched' : 'closed');
          earnedRef.current = false;
          load();
        } else if (type === sdk.AdEventType.ERROR) {
          showingRef.current = false;
          readyRef.current = false;
          clearTimeout(loadTimer);
          setStatus('unavailable');
          settle(earnedRef.current ? 'watched' : 'error');
          clearTimeout(retryTimer);
          retryTimer = setTimeout(load, RETRY_DELAYS[Math.min(attempt++, RETRY_DELAYS.length - 1)]);
        }
      });
      load();
    };
    start().catch(() => { if (!disposed) setStatus('unavailable'); });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !showingRef.current && !readyRef.current) setRevision((value) => value + 1);
    });
    return () => {
      disposed = true;
      sub.remove();
      unsubscribe?.();
      clearTimeout(retryTimer);
      clearTimeout(loadTimer);
      adRef.current = null;
      showingRef.current = false;
      settle(earnedRef.current ? 'watched' : 'error');
    };
  }, [enabled, revision, settle]);

  const showAd = useCallback((onResult: (result: RewardedAdResult) => void) => {
    const ad = adRef.current;
    if (!ad || !readyRef.current || showingRef.current) { onResult('not_available'); return; }
    if (pendingRef.current) { onResult('error'); return; }
    readyRef.current = false;
    showingRef.current = true;
    setStatus('loading');
    earnedRef.current = false;
    pendingRef.current = onResult;
    resultTimer.current = setTimeout(() => {
      // A recorded reward is never discarded just because close delivery was delayed.
      settle(earnedRef.current ? 'watched' : 'timeout');
    }, 120000);
    try {
      void ad.show().catch(() => {
        showingRef.current = false;
        settle('error');
        setRevision((value) => value + 1);
      });
    } catch {
      showingRef.current = false;
      settle('error');
      setRevision((value) => value + 1);
    }
  }, [settle]);

  const openPrivacyOptions = useCallback(async () => {
    const sdk = getAdsSdk();
    if (!sdk) return;
    try {
      const info = await sdk.AdsConsent.showPrivacyOptionsForm();
      setPrivacyOptionsRequired(info.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
      setRevision((value) => value + 1);
    } catch { Alert.alert('Privacy options', 'Privacy options could not be opened. Please try again.'); }
  }, []);

  return { status, isLoaded: status === 'ready', showAd, privacyOptionsRequired, openPrivacyOptions };
}
