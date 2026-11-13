import { Alert, Linking } from 'react-native';

export async function openExternalLink(url: string) {
  try { await Linking.openURL(url); }
  catch { Alert.alert('Link unavailable', 'This page could not be opened. Please try again.'); }
}
