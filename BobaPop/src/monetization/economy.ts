import type { SaveData } from '../hooks/saveDataCore';

export const INITIAL_LIVES = 3;
function rewardValue(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 3 ? parsed : fallback;
}
// Bounded build-time tuning; every ad event carries these values for cohort comparisons.
export const ENERGY_AD_REWARD = rewardValue(process.env.EXPO_PUBLIC_ENERGY_AD_REWARD, 2);
export const FIRST_CLEAR_ENERGY_REFUND = 1;
export const CONTINUE_LIVES = rewardValue(process.env.EXPO_PUBLIC_CONTINUE_AD_LIVES, 2);
export const REWARD_POLICY_ID = `energy_${ENERGY_AD_REWARD}_lives_${CONTINUE_LIVES}_double_bobas_v1`;

export function getEnergyAdReward(energy: number, maxEnergy: number): number {
  return Math.min(ENERGY_AD_REWARD, Math.max(0, maxEnergy - energy));
}

export interface EnergyGrant {
  added: number;
  energyBefore: number;
  energyAfter: number;
}

export interface CompletionReward {
  firstClear: boolean;
  energyRefund: number;
  badgeUnlocks: string[];
  bobasEarned: number;
  bonusClaimId: string | null;
}

export function hasUnlimitedEnergy(save: Pick<SaveData, 'adsRemoved' | 'plusExpiresAt'>, now = Date.now()): boolean {
  return save.adsRemoved && (save.plusExpiresAt === null || save.plusExpiresAt > now);
}
