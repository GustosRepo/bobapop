type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

const sessionCounters = {
  adsWatched: 0,
  continueOffers: 0,
  continueAccepts: 0,
  failures: 0,
};

export function trackGameEvent(eventName: string, params: AnalyticsParams = {}) {
  if (__DEV__) {
    console.log('[Analytics]', eventName, params);
  }
}

export function trackLevelFail(levelIndex: number, score: number, continuesUsed: number) {
  sessionCounters.failures += 1;
  trackGameEvent('level_fail', {
    level_number: levelIndex + 1,
    score,
    continues_used_per_level: continuesUsed,
    drop_off_after_fail: false,
  });
}

export function trackContinueOffer(levelIndex: number, continueNumber: number, rewardLives: number) {
  sessionCounters.continueOffers += 1;
  trackGameEvent('continue_offer_shown', {
    level_number: levelIndex + 1,
    continue_number: continueNumber,
    reward_lives: rewardLives,
  });
}

export function trackContinueAccepted(levelIndex: number, continueNumber: number, rewardLives: number) {
  sessionCounters.continueAccepts += 1;
  trackGameEvent('continue_accepted', {
    level_number: levelIndex + 1,
    continue_number: continueNumber,
    reward_lives: rewardLives,
    continue_conversion_rate: getContinueConversionRate(),
  });
}

export function trackRewardedAdResult(
  levelIndex: number,
  continueNumber: number,
  result: 'watched' | 'not_available' | 'skipped' | 'closed' | 'error',
) {
  if (result === 'watched') sessionCounters.adsWatched += 1;
  trackGameEvent('rewarded_ad_result', {
    level_number: levelIndex + 1,
    continue_number: continueNumber,
    result,
    ads_watched_per_session: sessionCounters.adsWatched,
  });
}

export function trackGameOverExit(levelIndex: number, action: 'retry' | 'level_select') {
  trackGameEvent('game_over_exit', {
    level_number: levelIndex + 1,
    action,
    drop_off_after_fail: false,
  });
}

export function getContinueConversionRate() {
  if (sessionCounters.continueOffers === 0) return 0;
  return sessionCounters.continueAccepts / sessionCounters.continueOffers;
}
