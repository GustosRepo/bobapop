export type PlusPlanId = 'bobapop_plus_yearly' | 'bobapop_plus_monthly';

export interface PlusPlan {
  id: PlusPlanId;
  title: string;
  price: string;
  period: string;
  badge?: string;
  savings?: string;
}

export const PLUS_PLANS: PlusPlan[] = [
  {
    id: 'bobapop_plus_yearly',
    title: 'Yearly',
    price: '$14.99',
    period: 'year',
    badge: 'Best Value',
    savings: 'Save 37%',
  },
  {
    id: 'bobapop_plus_monthly',
    title: 'Monthly',
    price: '$1.99',
    period: 'month',
  },
];

export const PLUS_BENEFITS = [
  'Ad-free continues',
  'No continue countdowns',
  'Exclusive skins later',
  'Supports new worlds',
];

export const PRIVACY_POLICY_URL = 'https://codewerx.com/privacy';
export const TERMS_URL = 'https://codewerx.com/terms';
