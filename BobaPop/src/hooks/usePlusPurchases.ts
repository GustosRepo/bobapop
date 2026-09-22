import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useIAP } from 'expo-iap';
import type { ProductSubscription, Purchase } from 'expo-iap';
import { PLUS_PLANS, PlusPlanId } from '../monetization/plus';

const PLUS_PRODUCT_IDS = PLUS_PLANS.map((plan) => plan.id);

function isPlusPurchase(purchase: Purchase): boolean {
  return PLUS_PRODUCT_IDS.includes(purchase.productId as PlusPlanId)
    && purchase.purchaseState === 'purchased';
}

function findSubscriptionOffer(product?: ProductSubscription) {
  if (!product || product.platform !== 'android') return undefined;
  return product.subscriptionOffers?.[0]?.offerTokenAndroid ?? undefined;
}

export function usePlusPurchases(onEntitlementChange: (active: boolean) => void) {
  const [busyPlanId, setBusyPlanId] = useState<PlusPlanId | null>(null);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const finishTransactionRef = useRef<ReturnType<typeof useIAP>['finishTransaction'] | null>(null);

  const iap = useIAP({
    onPurchaseSuccess: async (purchase) => {
      if (!isPlusPurchase(purchase)) return;
      try {
        await finishTransactionRef.current?.({ purchase, isConsumable: false });
        onEntitlementChange(true);
        setStoreMessage(null);
      } catch {
        setStoreMessage('Purchase completed, but final confirmation failed. Use Restore Purchase.');
      } finally {
        setBusyPlanId(null);
      }
    },
    onPurchaseError: (error) => {
      setBusyPlanId(null);
      setStoreMessage(error.message || 'Purchase could not be completed.');
    },
    onError: (error) => {
      setStoreMessage(error.message || 'Store is unavailable right now.');
    },
  });

  finishTransactionRef.current = iap.finishTransaction;

  useEffect(() => {
    if (!iap.connected) return;
    iap.fetchProducts({ skus: PLUS_PRODUCT_IDS, type: 'subs' }).catch(() => {});
    iap.getActiveSubscriptions(PLUS_PRODUCT_IDS).catch(() => {});
    iap.hasActiveSubscriptions(PLUS_PRODUCT_IDS)
      .then((hasPlus) => {
        onEntitlementChange(hasPlus);
      })
      .catch(() => {});
  }, [iap.connected, onEntitlementChange]);

  useEffect(() => {
    if (!iap.connected || iap.activeSubscriptions.length === 0) return;
    const hasPlus = iap.activeSubscriptions.some((subscription) => (
      PLUS_PRODUCT_IDS.includes(subscription.productId as PlusPlanId) && subscription.isActive
    ));
    onEntitlementChange(hasPlus);
  }, [iap.activeSubscriptions, iap.connected, onEntitlementChange]);

  const storePlans = useMemo(() => {
    return PLUS_PLANS.map((plan) => {
      const product = iap.subscriptions.find((sub) => sub.id === plan.id);
      return {
        ...plan,
        price: product?.displayPrice ?? plan.price,
      };
    });
  }, [iap.subscriptions]);

  const purchasePlan = useCallback(async (planId: PlusPlanId) => {
    const product = iap.subscriptions.find((sub) => sub.id === planId);
    setBusyPlanId(planId);
    setStoreMessage(null);
    try {
      if (Platform.OS === 'ios') {
        await iap.requestPurchase({
          type: 'subs',
          request: { apple: { sku: planId } },
        });
      } else {
        const offerToken = findSubscriptionOffer(product);
        await iap.requestPurchase({
          type: 'subs',
          request: {
            google: {
              skus: [planId],
              subscriptionOffers: offerToken ? [{ sku: planId, offerToken }] : undefined,
            },
          },
        });
      }
    } catch (error) {
      setBusyPlanId(null);
      setStoreMessage(error instanceof Error ? error.message : 'Purchase could not be started.');
    }
  }, [iap]);

  const restorePurchases = useCallback(async () => {
    setStoreMessage(null);
    try {
      await iap.restorePurchases();
      await iap.getActiveSubscriptions(PLUS_PRODUCT_IDS);
      const hasPlus = await iap.hasActiveSubscriptions(PLUS_PRODUCT_IDS);
      onEntitlementChange(hasPlus);
      if (hasPlus) {
        setStoreMessage(null);
      } else {
        setStoreMessage('No active BobaPop Plus subscription was found.');
      }
    } catch (error) {
      setStoreMessage(error instanceof Error ? error.message : 'Restore failed.');
    }
  }, [iap, onEntitlementChange]);

  return {
    busyPlanId,
    connected: iap.connected,
    storeMessage,
    storePlans,
    purchasePlan,
    restorePurchases,
  };
}
