// Keep native ad components out of Metro's browser dependency graph.
export function getAdsSdk(): typeof import('react-native-google-mobile-ads') | null {
  return null;
}
