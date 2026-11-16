import { Platform } from 'react-native';

export const AD_PLACEMENTS = ['continue', 'energy', 'clear_bonus'] as const;
export type AdPlacement = typeof AD_PLACEMENTS[number];
export type AdContext = Record<string, string | number | boolean | null | undefined>;

export function resolveRewardedUnitId(placement: AdPlacement, testId: string): string | null {
  if (__DEV__ || (process.env.EXPO_PUBLIC_ALLOW_TEST_ADS_IN_RELEASE === 'true'
    && process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true')) return testId;
  // Expo requires literal environment property access for values embedded in native bundles.
  const ios = Platform.OS === 'ios';
  const specific = placement === 'continue'
    ? (ios ? process.env.EXPO_PUBLIC_ADMOB_CONTINUE_IOS_UNIT_ID : process.env.EXPO_PUBLIC_ADMOB_CONTINUE_ANDROID_UNIT_ID)
    : placement === 'energy'
    ? (ios ? process.env.EXPO_PUBLIC_ADMOB_ENERGY_IOS_UNIT_ID : process.env.EXPO_PUBLIC_ADMOB_ENERGY_ANDROID_UNIT_ID)
    : (ios ? process.env.EXPO_PUBLIC_ADMOB_CLEAR_BONUS_IOS_UNIT_ID : process.env.EXPO_PUBLIC_ADMOB_CLEAR_BONUS_ANDROID_UNIT_ID);
  const id = specific || (ios ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID);
  return /^ca-app-pub-\d+\/\d+$/.test(id ?? '') && !/3940256099942544|0000000000000000/.test(id!) ? id! : null;
}
