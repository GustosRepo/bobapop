import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAnalyticsQueue } from './analyticsQueue';
import { PowerUpType } from '../game/types';

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsEvent {
  id: string;
  name: string;
  params: AnalyticsParams;
  createdAt: string;
  sessionId: string;
}

type AnalyticsTransport = (event: AnalyticsEvent) => Promise<void> | void;

const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const sessionCounters = {
  adsWatched: 0,
  continueOffers: 0,
  continueAccepts: 0,
  failures: 0,
};

let transport: AnalyticsTransport | null = null;
const queue = createAnalyticsQueue<AnalyticsEvent>(AsyncStorage);

export function configureAnalytics(nextTransport: AnalyticsTransport | null) {
  transport = nextTransport;
}

export async function flushAnalyticsQueue() {
  if (transport) await queue.flush(transport);
}

export function trackGameEvent(eventName: string, params: AnalyticsParams = {}) {
  const event: AnalyticsEvent = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: eventName,
    params,
    createdAt: new Date().toISOString(),
    sessionId,
  };

  if (__DEV__) {
    console.log('[Analytics]', event.name, event.params);
  }

  if (!transport) return;
  queue.enqueue(event)
    .then(flushAnalyticsQueue)
    .catch(() => {});
}

export function trackLevelStart(levelIndex: number, runId: number) {
  trackGameEvent('level_start', {
    level_number: levelIndex + 1,
    run_id: runId,
  });
}

export function trackLevelComplete(
  levelIndex: number,
  score: number,
  stars: number,
  bricksPopped: number,
  livesRemaining: number,
) {
  trackGameEvent('level_complete', {
    level_number: levelIndex + 1,
    score,
    stars,
    bricks_popped: bricksPopped,
    lives_remaining: livesRemaining,
  });
}

export function trackLifeLost(levelIndex: number, livesRemaining: number) {
  trackGameEvent('life_lost', {
    level_number: levelIndex + 1,
    lives_remaining: livesRemaining,
  });
}

export function trackPowerUpCollected(levelIndex: number, powerUp: PowerUpType) {
  trackGameEvent('power_up_collected', {
    level_number: levelIndex + 1,
    power_up: powerUp,
  });
}

export function trackBossEnraged(levelIndex: number) {
  trackGameEvent('boss_enraged', {
    level_number: levelIndex + 1,
  });
}

export function trackLevelFail(levelIndex: number, score: number, continuesUsed: number) {
  sessionCounters.failures += 1;
  trackGameEvent('level_fail', {
    level_number: levelIndex + 1,
    score,
    continues_used_per_level: continuesUsed,
    failures_this_session: sessionCounters.failures,
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
  result: 'watched' | 'not_available' | 'skipped' | 'closed' | 'timeout' | 'error',
) {
  if (result === 'watched') sessionCounters.adsWatched += 1;
  trackGameEvent('rewarded_ad_result', {
    level_number: levelIndex + 1,
    continue_number: continueNumber,
    result,
    ads_watched_per_session: sessionCounters.adsWatched,
  });
}

export function trackEnergyAdResult(
  result: 'watched' | 'not_available' | 'skipped' | 'closed' | 'timeout' | 'error',
  energyBefore: number,
  energyAfter: number,
) {
  if (result === 'watched') sessionCounters.adsWatched += 1;
  trackGameEvent('energy_ad_result', {
    result,
    energy_before: energyBefore,
    energy_after: energyAfter,
    ads_watched_per_session: sessionCounters.adsWatched,
  });
}

export function trackGameOverExit(levelIndex: number, action: 'retry' | 'level_select') {
  trackGameEvent('game_over_exit', {
    level_number: levelIndex + 1,
    action,
    drop_off_after_fail: action === 'level_select',
  });
}

export function getContinueConversionRate() {
  if (sessionCounters.continueOffers === 0) return 0;
  return sessionCounters.continueAccepts / sessionCounters.continueOffers;
}
