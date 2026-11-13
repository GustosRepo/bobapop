import { Platform } from 'react-native';

type AdsSdk = typeof import('react-native-google-mobile-ads');
let cached: AdsSdk | null | undefined;

export function getAdsSdk(): AdsSdk | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') return (cached = null);
  try { cached = require('react-native-google-mobile-ads') as AdsSdk; }
  catch { cached = null; }
  return cached;
}
