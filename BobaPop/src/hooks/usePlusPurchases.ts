import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { getActiveSubscriptions, useIAP } from 'expo-iap';
import type { Purchase } from 'expo-iap';
import { buildStorePlans, PLUS_PLANS, PlusPlanId } from '../monetization/plus';

const PRODUCT_IDS = PLUS_PLANS.map((plan) => plan.id);

export function usePlusPurchases(onEntitlementChange: (active: boolean, expiresAt?: number | null) => void) {
  const [busyPlanId, setBusyPlanId] = useState<PlusPlanId | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const operationRef = useRef(false);
  const requestVersion = useRef(0);
  const mountedRef = useRef(true);
  const finishRef = useRef<ReturnType<typeof useIAP>['finishTransaction'] | null>(null);
  const onEntitlementRef = useRef(onEntitlementChange);
  onEntitlementRef.current = onEntitlementChange;

  const refreshEntitlement = useCallback(async () => {
    const version = ++requestVersion.current;
    // The hook's hasActiveSubscriptions swallows errors and returns false.
    // This API throws, allowing cached access to survive a store outage.
    const subscriptions = await getActiveSubscriptions(PRODUCT_IDS);
    if (!mountedRef.current || version !== requestVersion.current) return null;
    const active = subscriptions.filter((subscription) => PRODUCT_IDS.includes(subscription.productId as PlusPlanId)
      && subscription.isActive && (!subscription.expirationDateIOS || subscription.expirationDateIOS > Date.now()));
    const expirations = active.map((sub) => sub.expirationDateIOS).filter((date): date is number => typeof date === 'number');
    onEntitlementRef.current(active.length > 0, expirations.length ? Math.max(...expirations) : null);
    return active.length > 0;
  }, []);

  const iap = useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      if (!PRODUCT_IDS.includes(purchase.productId as PlusPlanId) || purchase.purchaseState !== 'purchased') return;
      ++requestVersion.current; // invalidate any older verification already in flight
      try {
        if (!finishRef.current) throw new Error('Store is not ready.');
        await finishRef.current({ purchase, isConsumable: false });
        const expiry = 'expirationDateIOS' in purchase ? purchase.expirationDateIOS : null;
        onEntitlementRef.current(true, typeof expiry === 'number' ? expiry : null);
        setStoreMessage('BobaPop Plus is active.');
      } catch {
        setStoreMessage('Purchase completed, but confirmation failed. Use Restore Purchase.');
      } finally {
        operationRef.current = false;
        setBusyPlanId(null);
      }
    },
    onPurchaseError: (error) => {
      operationRef.current = false;
      setBusyPlanId(null);
      setStoreMessage(error.message || 'Purchase could not be completed.');
    },
    onError: (error) => setStoreMessage(error.message || 'Store is unavailable right now.'),
  });
  finishRef.current = iap.finishTransaction;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; ++requestVersion.current; };
  }, []);

  const reloadProducts = useCallback(async () => {
    if (!iap.connected) return;
    setStoreMessage(null);
    try { await iap.fetchProducts({ skus: PRODUCT_IDS, type: 'subs' }); }
    catch { if (mountedRef.current) setStoreMessage('Plans could not be loaded. Please try again when the store is available.'); }
  }, [iap.connected, iap.fetchProducts]);

  useEffect(() => {
    if (!iap.connected) return;
    const refresh = () => {
      if (AppState.currentState !== 'active' || operationRef.current) return;
      refreshEntitlement().catch(() => {
        if (mountedRef.current) setStoreMessage('The store could not be reached. Existing access is preserved until its saved expiry.');
      });
    };
    void reloadProducts();
    refresh();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') { refresh(); void reloadProducts(); } });
    const timer = setInterval(refresh, 60000);
    return () => { sub.remove(); clearInterval(timer); ++requestVersion.current; };
  }, [iap.connected, reloadProducts, refreshEntitlement]);

  const storePlans = useMemo(() => buildStorePlans(iap.subscriptions), [iap.subscriptions]);

  const purchasePlan = useCallback(async (planId: PlusPlanId) => {
    if (operationRef.current) return;
    const plan = storePlans.find((item) => item.id === planId);
    const product = iap.subscriptions.find((item) => item.id === planId);
    if (!iap.connected || !product || !plan?.available) {
      setStoreMessage('This plan is not available from the store yet. Please try again.');
      return;
    }
    operationRef.current = true;
    setBusyPlanId(planId);
    setStoreMessage(null);
    try {
      if (Platform.OS === 'ios') {
        await iap.requestPurchase({ type: 'subs', request: { apple: { sku: planId } } });
      } else {
        // Match the regular base-plan offer used to display this plan's price.
        const offerToken = plan.offerToken;
        if (!offerToken) throw new Error('No eligible subscription offer is available.');
        await iap.requestPurchase({ type: 'subs', request: { google: {
          skus: [planId], subscriptionOffers: [{ sku: planId, offerToken }],
        } } });
      }
    } catch (error) {
      operationRef.current = false;
      setBusyPlanId(null);
      setStoreMessage(error instanceof Error ? error.message : 'Purchase could not be started.');
    }
  }, [iap, storePlans]);

  const restorePurchases = useCallback(async () => {
    if (operationRef.current || !iap.connected) return;
    operationRef.current = true;
    setRestoring(true);
    setStoreMessage(null);
    try {
      await iap.restorePurchases();
      const active = await refreshEntitlement();
      setStoreMessage(active ? 'BobaPop Plus has been restored.' : 'No active BobaPop Plus subscription was found.');
    } catch {
      setStoreMessage('The store could not verify purchases. Existing access has been kept. Please retry.');
    } finally {
      operationRef.current = false;
      setRestoring(false);
    }
  }, [iap, refreshEntitlement]);

  return { busyPlanId, restoring, connected: iap.connected, storeMessage, storePlans, purchasePlan, restorePurchases, reloadProducts };
}
