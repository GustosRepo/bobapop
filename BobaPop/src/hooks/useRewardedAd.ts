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
export type RewardedAdResult = 'watched' | 'not_available' | 'skipped' | 'closed' | 'error';

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
  const pendingReward = useRef<((result: RewardedAdResult) => void) | null>(null);
  const rewardEarnedRef = useRef(false);

  useEffect(() => {
    if (isEarnedReward && pendingReward.current) {
      rewardEarnedRef.current = true;
      pendingReward.current('watched');
      pendingReward.current = null;
    }
  }, [isEarnedReward]);

  useEffect(() => {
    if (!isClosed) return;
    if (!rewardEarnedRef.current && pendingReward.current) {
      pendingReward.current('closed');
      pendingReward.current = null;
    }
    rewardEarnedRef.current = false;
  }, [isClosed]);

  /**
   * Show the rewarded ad. Rewards are granted only after the ad SDK reports
   * an earned reward.
   */
  const showAd = useCallback(
    (onResult: (result: RewardedAdResult) => void) => {
      if (!isLoaded) {
        onResult('not_available');
        load();
        return;
      }
      pendingReward.current = onResult;
      rewardEarnedRef.current = false;
      try {
        show();
      } catch {
        pendingReward.current = null;
        onResult('error');
        load();
      }
    },
    [isLoaded, load, show],
  );

  return { isLoaded, showAd };
}
