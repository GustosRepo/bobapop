import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import type { PaidEvent } from 'react-native-google-mobile-ads';
import { getAdsSdk } from '../monetization/adsSdk';
import { AD_PLACEMENTS, AdContext, AdPlacement, resolveRewardedUnitId } from '../monetization/adPlacements';
import { trackAdEvent, trackGameEvent } from '../analytics/gameAnalytics';

export type RewardedAdResult = 'watched' | 'not_available' | 'skipped' | 'closed' | 'timeout' | 'error';
export type RewardedAdStatus = 'loading' | 'ready' | 'unavailable';
type Ad = ReturnType<NonNullable<ReturnType<typeof getAdsSdk>>['RewardedAd']['createForAdRequest']>;
type Slot = {
  ad: Ad | null; readyAt: number; attempt: number; generation: number;
  unsubscribe?: () => void;
  loadTimer?: ReturnType<typeof setTimeout>;
  retryTimer?: ReturnType<typeof setTimeout>;
  expiryTimer?: ReturnType<typeof setTimeout>;
};
type ActiveAd = {
  placement: AdPlacement; context: AdContext; earned: boolean; closed: boolean; opened: boolean;
  callback: ((result: RewardedAdResult) => void) | null;
  timer?: ReturnType<typeof setTimeout>; closeTimer?: ReturnType<typeof setTimeout>;
};
const RETRY_DELAYS = [1000, 3000, 8000, 15000, 30000];
// Google ads expire after one hour. Refresh before that boundary, including on foreground.
export const AD_MAX_AGE_MS = 55 * 60 * 1000;
const initialStatuses = (): Record<AdPlacement, RewardedAdStatus> => ({ continue: 'unavailable', energy: 'unavailable', clear_bonus: 'unavailable' });

export function useRewardedAd(enabled = true) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [busy, setBusy] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const [revision, setRevision] = useState(0);
  const slots = useRef<Partial<Record<AdPlacement, Slot>>>({});
  const active = useRef<ActiveAd | null>(null);
  const reload = useRef<(placement: AdPlacement) => void>(() => {});

  const settle = useCallback((result: RewardedAdResult) => {
    const current = active.current;
    if (!current?.callback) return;
    clearTimeout(current.timer);
    const callback = current.callback;
    current.callback = null;
    trackAdEvent('ad_result', current.placement, { ...current.context, result });
    callback(result);
  }, []);

  useEffect(() => {
    const sdk = getAdsSdk();
    let mounted = true;
    sdk?.AdsConsent.getConsentInfo().then((info) => {
      if (mounted) setPrivacyOptionsRequired(info.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const sdk = getAdsSdk();
    setStatuses(initialStatuses());
    if (!enabled || !sdk) return;
    let disposed = false;
    let initialized = false;
    let starting = false;
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    let startupAttempt = 0;
    const units = Object.fromEntries(AD_PLACEMENTS.map((placement) => [placement, resolveRewardedUnitId(placement, sdk.TestIds.REWARDED)])) as Record<AdPlacement, string | null>;
    const update = (placement: AdPlacement, status: RewardedAdStatus) => {
      if (!disposed) setStatuses((prev) => ({ ...prev, [placement]: status }));
    };
    const retire = (slot: Slot) => {
      slot.generation++;
      slot.unsubscribe?.();
      slot.unsubscribe = undefined;
      clearTimeout(slot.loadTimer);
      clearTimeout(slot.retryTimer);
      clearTimeout(slot.expiryTimer);
      slot.ad = null;
      slot.readyAt = 0;
    };
    const finish = (result: RewardedAdResult) => {
      const current = active.current;
      if (!current) return;
      clearTimeout(current.closeTimer);
      settle(result);
      active.current = null;
      if (!disposed) {
        setBusy(false);
        load(current.placement);
      }
    };
    const failed = (placement: AdPlacement, slot: Slot, errorCode: string) => {
      const current = active.current;
      if (current?.placement === placement) {
        clearTimeout(current.closeTimer);
        settle(current.earned ? 'watched' : 'error');
        active.current = null;
        setBusy(false);
      }
      retire(slot);
      update(placement, 'unavailable');
      const delay = RETRY_DELAYS[Math.min(slot.attempt++, RETRY_DELAYS.length - 1)];
      trackAdEvent('ad_load_failed', placement, { error_code: errorCode, retry_delay_ms: delay });
      slot.retryTimer = setTimeout(() => load(placement), delay);
    };
    const load = (placement: AdPlacement) => {
      if (disposed || !initialized || !units[placement] || active.current?.placement === placement) return;
      const slot = slots.current[placement] ?? (slots.current[placement] = { ad: null, readyAt: 0, attempt: 0, generation: 0 });
      retire(slot);
      // Do not make background requests. Resume an empty slot when the app returns.
      if (AppState.currentState && AppState.currentState !== 'active') { update(placement, 'unavailable'); return; }
      const generation = slot.generation;
      update(placement, 'loading');
      const startedAt = Date.now();
      trackAdEvent('ad_request', placement, { ad_unit_id: units[placement] });
      try {
        // UMP's stored privacy choices determine the serving mode. Do not override them
        // with a blanket non-personalized flag or treat canRequestAds as personalization consent.
        const ad = sdk.RewardedAd.createForAdRequest(units[placement]!);
        slot.ad = ad;
        let paidReported = false;
        slot.unsubscribe = ad.addAdEventsListener(({ type, payload }) => {
          if (disposed || generation !== slot.generation) return;
          const current = active.current?.placement === placement ? active.current : null;
          if (type === sdk.RewardedAdEventType.LOADED) {
            clearTimeout(slot.loadTimer);
            slot.attempt = 0;
            slot.readyAt = Date.now();
            update(placement, 'ready');
            trackAdEvent('ad_loaded', placement, { load_ms: Date.now() - startedAt });
            slot.expiryTimer = setTimeout(() => load(placement), AD_MAX_AGE_MS);
          } else if (type === sdk.AdEventType.PAID && current && !paidReported) {
            // v16 sends PaidEvent at runtime but omits it from AdEventPayload's TS union.
            const paid = payload as unknown as PaidEvent;
            if (paid && Number.isFinite(paid.value) && paid.value >= 0 && typeof paid.currency === 'string') {
              paidReported = true;
              trackAdEvent('ad_revenue', placement, { ...current.context, ad_unit_id: units[placement],
                value: paid.value, currency: paid.currency, precision: paid.precision });
            }
          } else if (type === sdk.AdEventType.OPENED && current) {
            if (current.opened) return;
            current.opened = true;
            trackAdEvent('ad_opened', placement, current.context);
          } else if (type === sdk.RewardedAdEventType.EARNED_REWARD && current) {
            current.earned = true;
            if (current.closed) finish('watched');
          } else if (type === sdk.AdEventType.CLOSED && current) {
            if (current.closed) return;
            current.closed = true;
            if (current.earned) finish('watched');
            // Some mediation adapters deliver reward after close. Keep this request's
            // listener alive briefly; never let an old reward affect the next request.
            else current.closeTimer = setTimeout(() => finish(current.earned ? 'watched' : 'closed'), 1000);
          } else if (type === sdk.AdEventType.ERROR) {
            const error = payload as unknown as { code?: string } | undefined;
            failed(placement, slot, error?.code ?? 'sdk_error');
          }
        });
        slot.loadTimer = setTimeout(() => failed(placement, slot, 'load_timeout'), 15000);
        ad.load();
      } catch { failed(placement, slot, 'load_exception'); }
    };
    reload.current = load;
    const start = async () => {
      if (disposed || starting || initialized) return;
      starting = true;
      try {
        let info;
        try { info = await sdk.AdsConsent.gatherConsent(); }
        catch { info = await sdk.AdsConsent.getConsentInfo(); }
        if (disposed) return;
        setPrivacyOptionsRequired(info.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
        if (!info.canRequestAds) return;
        const adapters = await sdk.default().initialize();
        if (disposed) return;
        initialized = true;
        trackGameEvent('ads_initialized', { adapter_count: Array.isArray(adapters) ? adapters.length : 0 });
        AD_PLACEMENTS.forEach(load);
      } catch {
        if (!disposed) startupTimer = setTimeout(start, RETRY_DELAYS[Math.min(startupAttempt++, RETRY_DELAYS.length - 1)]);
      } finally { starting = false; }
    };
    void start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || active.current) return;
      if (!initialized) { void start(); return; }
      AD_PLACEMENTS.forEach((placement) => {
        const slot = slots.current[placement];
        if (!slot?.readyAt || Date.now() - slot.readyAt >= AD_MAX_AGE_MS) load(placement);
      });
    });
    return () => {
      disposed = true;
      subscription.remove();
      clearTimeout(startupTimer);
      const current = active.current;
      if (current) {
        clearTimeout(current.closeTimer);
        settle(current.earned ? 'watched' : 'error');
        active.current = null;
      }
      Object.values(slots.current).forEach(retire);
      slots.current = {};
      reload.current = () => {};
      setBusy(false);
    };
  }, [enabled, revision, settle]);

  const showAd = useCallback((placement: AdPlacement, onResult: (result: RewardedAdResult) => void, context: AdContext = {}) => {
    const slot = slots.current[placement];
    if (active.current || !slot?.ad || !slot.readyAt || Date.now() - slot.readyAt >= AD_MAX_AGE_MS) {
      trackAdEvent('ad_result', placement, { ...context, result: 'not_available' });
      onResult('not_available');
      if (!active.current) reload.current(placement);
      return;
    }
    clearTimeout(slot.expiryTimer);
    slot.readyAt = 0;
    setStatuses((prev) => ({ ...prev, [placement]: 'loading' }));
    setBusy(true);
    const current: ActiveAd = { placement, context, earned: false, closed: false, opened: false, callback: onResult };
    active.current = current;
    trackAdEvent('ad_show_requested', placement, context);
    current.timer = setTimeout(() => {
      if (active.current !== current) return;
      if (current.earned) { settle('watched'); return; }
      if (current.opened) {
        // Long ads can still earn a valid reward. Keep the lock and callback until
        // native close rather than discarding a later SDK-earned reward.
        trackAdEvent('ad_watchdog', placement, { ...context, presentation_open: true });
        return;
      }
      // No presentation callback arrived: recover a hung show request.
      settle('timeout');
      active.current = null;
      setBusy(false);
      reload.current(placement);
    }, 120000);
    const rejected = () => {
      if (active.current !== current) return;
      clearTimeout(current.closeTimer);
      settle(current.earned ? 'watched' : 'error');
      active.current = null;
      setBusy(false);
      reload.current(placement);
    };
    try { void slot.ad.show().catch(rejected); } catch { rejected(); }
  }, [settle]);

  const openPrivacyOptions = useCallback(async () => {
    const sdk = getAdsSdk();
    if (!sdk || active.current) return;
    try {
      const info = await sdk.AdsConsent.showPrivacyOptionsForm();
      setPrivacyOptionsRequired(info.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
      setRevision((value) => value + 1);
    } catch { Alert.alert('Privacy options', 'Privacy options could not be opened. Please try again.'); }
  }, []);

  return { statuses, busy, showAd, privacyOptionsRequired, openPrivacyOptions };
}
