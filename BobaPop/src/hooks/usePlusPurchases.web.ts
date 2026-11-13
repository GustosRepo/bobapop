import { useState } from 'react';
import { PLUS_PLANS } from '../monetization/plus';

// Native store billing is available only in the iOS and Android app.
export function usePlusPurchases(_onEntitlementChange: (active: boolean, expiresAt?: number | null) => void) {
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const unavailable = async () => { setStoreMessage('BobaPop Plus purchases and restores are available in the iOS and Android app.'); };
  return {
    busyPlanId: null, restoring: false, connected: false,
    storeMessage, storePlans: PLUS_PLANS, purchasePlan: unavailable, restorePurchases: unavailable, reloadProducts: unavailable,
  };
}
