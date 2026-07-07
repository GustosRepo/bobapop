// ─── Save format versioning ────────────────────────────────────────────────────
//  Bump CURRENT_VERSION whenever SaveData gains new required fields.
//  Add a migration case below so old saves are upgraded rather than wiped.
export const CURRENT_VERSION = 8;
export const STORAGE_KEY = '@bobapop_save_v1';   // key never changes; version lives inside the JSON
export const BACKUP_STORAGE_KEY = '@bobapop_save_backup_v1';
export const MAX_ENERGY = 5;
export const ENERGY_REFILL_MS = 15 * 60 * 1000;

export interface SaveData {
  version: number;
  unlockedUpTo: number;
  levelStars: Record<number, number>;      // levelIndex -> best stars (0-3)
  levelHighScores: Record<number, number>; // levelIndex -> best score
  unlockedLevelIds: string[];
  levelStarsById: Record<string, number>;
  levelHighScoresById: Record<string, number>;
  totalBobas: number;                      // lifetime brick pop count
  seenWorlds: number[];                    // world indices whose intro has been shown
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  adsRemoved: boolean;
  seenOnboarding: Record<string, boolean>;
  energyLives: number;                     // persisted legacy field name; UI calls this Energy
  energyUpdatedAt: number;
}

export function buildDefaultSave(levelIds: string[], now = Date.now()): SaveData {
  return {
    version: CURRENT_VERSION,
    unlockedUpTo: 0,
    levelStars: {},
    levelHighScores: {},
    unlockedLevelIds: levelIds[0] ? [levelIds[0]] : [],
    levelStarsById: {},
    levelHighScoresById: {},
    totalBobas: 0,
    seenWorlds: [],
    soundEnabled: true,
    hapticsEnabled: true,
    adsRemoved: false,
    seenOnboarding: {},
    energyLives: MAX_ENERGY,
    energyUpdatedAt: now,
  };
}

export function mapIndexRecordToLevelIds(
  record: Record<number, number> | undefined,
  levelIds: string[],
): Record<string, number> {
  if (!record || typeof record !== 'object') return {};
  return Object.entries(record).reduce<Record<string, number>>((acc, [index, value]) => {
    const levelId = levelIds[Number(index)];
    if (levelId && typeof value === 'number') {
      acc[levelId] = value;
    }
    return acc;
  }, {});
}

export function mapLevelIdsToIndexRecord(
  record: Record<string, number>,
  levelIds: string[],
): Record<number, number> {
  return levelIds.reduce<Record<number, number>>((acc, levelId, index) => {
    const value = record[levelId];
    if (typeof value === 'number') {
      acc[index] = value;
    }
    return acc;
  }, {});
}

function unlockedIdsFromLegacyIndex(unlockedUpTo: number, levelIds: string[]): string[] {
  const lastUnlocked = Math.min(Math.max(unlockedUpTo, 0), levelIds.length - 1);
  return levelIds.slice(0, lastUnlocked + 1);
}

// ─── Migration table ──────────────────────────────────────────────────────────
// Each function receives the raw parsed object and returns a migrated SaveData.
// Add one entry per version bump.
export function migrateSaveData(raw: Record<string, unknown>, levelIds: string[], now = Date.now()): SaveData {
  let data = { ...raw } as unknown as SaveData;
  const defaultSave = buildDefaultSave(levelIds, now);

  // v0 -> v1: levelStars may be missing
  if (!data.version || data.version < 1) {
    data = {
      ...defaultSave,
      unlockedUpTo: typeof data.unlockedUpTo === 'number' ? data.unlockedUpTo : 0,
      levelStars: typeof data.levelStars === 'object' && data.levelStars !== null
        ? data.levelStars
        : {},
      version: 1,
    };
  }

  // v1 -> v2: add levelHighScores and totalBobas
  if (data.version < 2) {
    data = {
      ...data,
      levelHighScores: {},
      totalBobas: 0,
      version: 2,
    };
  }

  // v2 -> v3: add seenWorlds
  if (data.version < 3) {
    data = { ...data, seenWorlds: [], version: 3 };
  }

  // v3 -> v4: add soundEnabled / hapticsEnabled
  if (data.version < 4) {
    data = { ...data, soundEnabled: true, hapticsEnabled: true, version: 4 };
  }

  // v4 -> v5: add adsRemoved
  if (data.version < 5) {
    data = { ...data, adsRemoved: false, version: 5 };
  }

  // v5 -> v6: add one-time onboarding flags
  if (data.version < 6) {
    data = { ...data, seenOnboarding: {}, version: 6 };
  }

  if (data.version < 7) {
    data = { ...data, energyLives: MAX_ENERGY, energyUpdatedAt: now, version: 7 };
  }

  if (data.version < 8) {
    data = {
      ...data,
      unlockedLevelIds: unlockedIdsFromLegacyIndex(data.unlockedUpTo, levelIds),
      levelStarsById: mapIndexRecordToLevelIds(data.levelStars, levelIds),
      levelHighScoresById: mapIndexRecordToLevelIds(data.levelHighScores, levelIds),
      version: 8,
    };
  }

  const unlockedLevelIds = Array.isArray(data.unlockedLevelIds)
    ? data.unlockedLevelIds.filter((id): id is string => typeof id === 'string' && levelIds.includes(id))
    : defaultSave.unlockedLevelIds;

  return {
    ...defaultSave,
    ...data,
    version: CURRENT_VERSION,
    unlockedLevelIds: unlockedLevelIds.length > 0 ? unlockedLevelIds : defaultSave.unlockedLevelIds,
    levelStarsById: typeof data.levelStarsById === 'object' && data.levelStarsById !== null ? data.levelStarsById : {},
    levelHighScoresById: typeof data.levelHighScoresById === 'object' && data.levelHighScoresById !== null ? data.levelHighScoresById : {},
  };
}

export function resolveEnergy(save: SaveData, now = Date.now()): SaveData {
  if (save.energyLives >= MAX_ENERGY) {
    return { ...save, energyLives: MAX_ENERGY, energyUpdatedAt: now };
  }

  const elapsed = Math.max(0, now - save.energyUpdatedAt);
  const refills = Math.floor(elapsed / ENERGY_REFILL_MS);
  if (refills <= 0) return save;

  const energyLives = Math.min(MAX_ENERGY, save.energyLives + refills);
  return {
    ...save,
    energyLives,
    energyUpdatedAt: energyLives >= MAX_ENERGY
      ? now
      : save.energyUpdatedAt + refills * ENERGY_REFILL_MS,
  };
}
