import { CONTINUE_LIVES } from './economy';

export type ContinueAvailabilityReason = 'available' | 'early_game' | 'max_continues' | 'ads_removed';

export interface ContinueOffer {
  canShow: boolean;
  reason: ContinueAvailabilityReason;
  continueNumber: number;
  rewardLives: number;
  title: string;
  subtitle: string;
  buttonText: string;
}

export interface ContinuePolicy {
  noAdsThroughLevel: number;
  fullSystemStartLevel: number;
  introMaxContinues: number;
  maxContinues: number;
  rewardLives: number;
}

export const CONTINUE_POLICY: ContinuePolicy = {
  noAdsThroughLevel: 3,
  fullSystemStartLevel: 6,
  introMaxContinues: 1,
  maxContinues: 2,
  rewardLives: CONTINUE_LIVES,
};

export function getContinueOffer(levelIndex: number, continuesUsed: number, plusActive: boolean, policy = CONTINUE_POLICY): ContinueOffer {
  const levelNumber = levelIndex + 1;
  const continueNumber = continuesUsed + 1;
  const buttonText = plusActive ? `Continue · +${policy.rewardLives} Lives` : `Watch Ad · +${policy.rewardLives} Lives`;
  if (levelNumber <= policy.noAdsThroughLevel) {
    return {
      canShow: false, reason: 'early_game', continueNumber, rewardLives: 0,
      title: 'Almost had it!', subtitle: 'Try a fresh run. Continues unlock at Level 4.', buttonText,
    };
  }
  const maxContinues = levelNumber < policy.fullSystemStartLevel ? policy.introMaxContinues : policy.maxContinues;
  if (continuesUsed >= maxContinues) {
    return {
      canShow: false, reason: 'max_continues', continueNumber, rewardLives: 0,
      title: 'Fresh cup?', subtitle: 'No continues left in this run. Retry or choose another level.', buttonText,
    };
  }
  return {
    canShow: true, reason: plusActive ? 'ads_removed' : 'available', continueNumber,
    rewardLives: policy.rewardLives, title: 'Keep this run going?',
    subtitle: `Keep your score and cleared blocks. Continue ${continueNumber} of ${maxContinues}.`, buttonText,
  };
}
