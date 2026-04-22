import { useCallback, useEffect, useRef } from 'react';
import {
  useRewardedAd as useAdMobRewardedAd,
  TestIds,
} from 'react-native-google-mobile-ads';

// ─── Swap for real unit ID before shipping ────────────────────────────────────
const REWARDED_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-8863066373093222/9842491767';

const REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };

export function useRewardedAd() {
  const { isLoaded, isEarnedReward, isClosed, load, show } = useAdMobRewardedAd(
    REWARDED_UNIT_ID,
    REQUEST_OPTIONS,
  );

  // Load ad on mount
  useEffect(() => {
    load();
  }, [load]);

  // Reload after it closes so it's ready for next game over
  useEffect(() => {
    if (isClosed) load();
  }, [isClosed, load]);

  // Pending reward callback — fired when isEarnedReward flips true
  const pendingReward = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isEarnedReward && pendingReward.current) {
      pendingReward.current();
      pendingReward.current = null;
    }
  }, [isEarnedReward]);

  /**
   * Show the rewarded ad. If the ad isn't ready, grants the reward immediately
   * rather than punishing the player for a network failure.
   */
  const showAd = useCallback(
    (onRewarded: () => void) => {
      if (!isLoaded) {
        onRewarded();
        return;
      }
      pendingReward.current = onRewarded;
      show();
    },
    [isLoaded, show],
  );

  return { isLoaded, showAd };
}

