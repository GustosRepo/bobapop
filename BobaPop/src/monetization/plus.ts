import type { ProductSubscription } from 'expo-iap';
import { CONTINUE_LIVES } from './economy';

export type PlusPlanId = 'bobapop_plus_yearly' | 'bobapop_plus_monthly';

export interface PlusPlan {
  id: PlusPlanId;
  title: string;
  price: string;
  available: boolean;
  offerToken?: string;
  period: string;
  badge?: string;
  savings?: string;
}

export const PLUS_PLANS: PlusPlan[] = [
  {
    id: 'bobapop_plus_yearly',
    title: 'Yearly',
    price: 'Unavailable',
    available: false,
    period: 'year',
  },
  {
    id: 'bobapop_plus_monthly',
    title: 'Monthly',
    price: 'Unavailable',
    available: false,
    period: 'month',
  },
];

export const PLUS_BENEFITS = [
  'Unlimited Energy',
  `Ad-free continues (+${CONTINUE_LIVES} lives)`,
  'Double clear Bobas without ads (Level 4+)',
  'Supports new worlds',
];

export const PRIVACY_POLICY_URL = 'https://www.code-werx.com/bobapop-privacy';
export const TERMS_URL = 'https://www.code-werx.com/bobapop-terms';

export function buildStorePlans(products: ProductSubscription[]): PlusPlan[] {
  const prices = new Map<string, { amount: number; currency: string }>();
  const plans = PLUS_PLANS.map((plan) => {
    const product = products.find((item) => item.id === plan.id);
    if (!product) return { ...plan };
    if (product.platform === 'android') {
      const period = plan.id === 'bobapop_plus_yearly' ? 'P1Y' : 'P1M';
      const offer = product.subscriptionOfferDetailsAndroid.find((item) => !item.offerId
        && item.pricingPhases.pricingPhaseList.some((phase) => phase.billingPeriod === period && phase.recurrenceMode === 1));
      const phase = offer?.pricingPhases.pricingPhaseList.find((item) => item.billingPeriod === period && item.recurrenceMode === 1);
      if (!offer || !phase) return { ...plan };
      prices.set(plan.id, { amount: Number(phase.priceAmountMicros) / 1e6, currency: phase.priceCurrencyCode });
      return { ...plan, price: phase.formattedPrice, available: true, offerToken: offer.offerToken };
    }
    if (typeof product.price === 'number' && product.price > 0) prices.set(plan.id, { amount: product.price, currency: product.currency });
    return { ...plan, price: product.displayPrice, available: !!product.displayPrice };
  });
  const yearly = prices.get('bobapop_plus_yearly');
  const monthly = prices.get('bobapop_plus_monthly');
  const savings = yearly && monthly && monthly.amount > 0 && yearly.currency === monthly.currency
    ? Math.floor((1 - yearly.amount / (monthly.amount * 12)) * 100) : 0;
  return plans.map((plan) => plan.id === 'bobapop_plus_yearly' && savings > 0 ? { ...plan, badge: 'Best Value', savings: `Save ${savings}%` } : plan);
}
