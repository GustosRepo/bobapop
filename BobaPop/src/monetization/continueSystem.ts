export type ContinueAvailabilityReason =
  | 'available'
  | 'early_game'
  | 'max_continues'
  | 'ads_removed';

export interface ContinueOffer {
  canShow: boolean;
  reason: ContinueAvailabilityReason;
  continueNumber: number;
  rewardLives: number;
  delaySeconds: number;
  title: string;
  subtitle: string;
  buttonText: string;
}

export interface ContinuePolicy {
  noAdsThroughLevel: number;
  introStartLevel: number;
  fullSystemStartLevel: number;
  introMaxContinues: number;
  maxContinues: number;
  offers: Array<{
    rewardLives: number;
    delaySeconds: number;
  }>;
}

export const CONTINUE_POLICY: ContinuePolicy = {
  noAdsThroughLevel: 3,
  introStartLevel: 4,
  fullSystemStartLevel: 6,
  introMaxContinues: 1,
  maxContinues: 3,
  offers: [
    { rewardLives: 2, delaySeconds: 0 },
    { rewardLives: 1, delaySeconds: 15 },
    { rewardLives: 1, delaySeconds: 45 },
  ],
};

export function getContinueOffer(
  levelIndex: number,
  continuesUsed: number,
  adsRemoved: boolean,
  policy = CONTINUE_POLICY,
): ContinueOffer {
  const levelNumber = levelIndex + 1;
  const continueNumber = continuesUsed + 1;

  if (adsRemoved) {
    return {
      canShow: true,
      reason: 'ads_removed',
      continueNumber,
      rewardLives: 2,
      delaySeconds: 0,
      title: 'Pop back in?',
      subtitle: 'Continue with 2 lives.',
      buttonText: 'Continue',
    };
  }

  if (levelNumber <= policy.noAdsThroughLevel) {
    return {
      canShow: false,
      reason: 'early_game',
      continueNumber,
      rewardLives: 0,
      delaySeconds: 0,
      title: 'Almost had it!',
      subtitle: 'Retry anytime. Ads unlock after Level 3.',
      buttonText: 'Watch Ad',
    };
  }

  const maxContinues = levelNumber < policy.fullSystemStartLevel
    ? policy.introMaxContinues
    : policy.maxContinues;

  if (continuesUsed >= maxContinues) {
    return {
      canShow: false,
      reason: 'max_continues',
      continueNumber,
      rewardLives: 0,
      delaySeconds: 0,
      title: 'Fresh cup?',
      subtitle: 'Restart the level or head back to choose another one.',
      buttonText: 'Watch Ad',
    };
  }

  const offer = policy.offers[Math.min(continuesUsed, policy.offers.length - 1)];
  return {
    canShow: true,
    reason: 'available',
    continueNumber,
    rewardLives: offer.rewardLives,
    delaySeconds: offer.delaySeconds,
    title: continueNumber === 1 ? 'One more sip?' : 'Need another boost?',
    subtitle: `Continue with ${offer.rewardLives} ${offer.rewardLives === 1 ? 'life' : 'lives'}.`,
    buttonText: 'Watch Ad',
  };
}
