import type { SaveData } from '../hooks/saveDataCore';

export const INITIAL_LIVES = 3;
export const ENERGY_AD_REWARD = 2;
export const FIRST_CLEAR_ENERGY_REFUND = 1;
export const CONTINUE_LIVES = 2;

export interface EnergyGrant {
  added: number;
  energyBefore: number;
  energyAfter: number;
}

export interface CompletionReward {
  firstClear: boolean;
  energyRefund: number;
  badgeUnlocks: string[];
}

export function hasUnlimitedEnergy(save: Pick<SaveData, 'adsRemoved' | 'plusExpiresAt'>, now = Date.now()): boolean {
  return save.adsRemoved && (save.plusExpiresAt === null || save.plusExpiresAt > now);
}
