import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Save format versioning ────────────────────────────────────────────────────
//  Bump CURRENT_VERSION whenever SaveData gains new required fields.
//  Add a migration case below so old saves are upgraded rather than wiped.
const CURRENT_VERSION = 8;
const STORAGE_KEY = '@bobapop_save_v1';   // key never changes; version lives inside the JSON
const MAX_ENERGY_LIVES = 5;
const ENERGY_REFILL_MS = 15 * 60 * 1000;

export interface SaveData {
  version: number;
  unlockedUpTo: number;
  levelStars: Record<number, number>;      // levelIndex → best stars (0–3)
  levelHighScores: Record<number, number>; // levelIndex → best score
  unlockedLevelIds: string[];
  levelStarsById: Record<string, number>;
  levelHighScoresById: Record<string, number>;
  totalBobas: number;                      // lifetime brick pop count
  seenWorlds: number[];                    // world indices whose intro has been shown
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  adsRemoved: boolean;
  seenOnboarding: Record<string, boolean>;
  energyLives: number;
  energyUpdatedAt: number;
}

function buildDefaultSave(levelIds: string[]): SaveData {
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
    energyLives: MAX_ENERGY_LIVES,
    energyUpdatedAt: Date.now(),
  };
}

function mapIndexRecordToLevelIds(
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

function mapLevelIdsToIndexRecord(
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
function migrate(raw: Record<string, unknown>, levelIds: string[]): SaveData {
  let data = { ...raw } as unknown as SaveData;
  const defaultSave = buildDefaultSave(levelIds);

  // v0 → v1: levelStars may be missing
  if (!data.version || data.version < 1) {
    data = {
      ...defaultSave,
      unlockedUpTo: typeof data.unlockedUpTo === 'number' ? data.unlockedUpTo : 0,
      levelStars:   typeof data.levelStars   === 'object' && data.levelStars !== null
        ? data.levelStars
        : {},
      version: 1,
    };
  }

  // v1 → v2: add levelHighScores and totalBobas
  if (data.version < 2) {
    data = {
      ...data,
      levelHighScores: {},
      totalBobas: 0,
      version: 2,
    };
  }

  // v2 → v3 would go here

  // v2 → v3: add seenWorlds
  if (data.version < 3) {
    data = { ...data, seenWorlds: [], version: 3 };
  }

  // v3 → v4: add soundEnabled / hapticsEnabled
  if (data.version < 4) {
    data = { ...data, soundEnabled: true, hapticsEnabled: true, version: 4 };
  }

  // v4 → v5: add adsRemoved
  if (data.version < 5) {
    data = { ...data, adsRemoved: false, version: 5 };
  }

  // v5 → v6: add one-time onboarding flags
  if (data.version < 6) {
    data = { ...data, seenOnboarding: {}, version: 6 };
  }

  if (data.version < 7) {
    data = { ...data, energyLives: MAX_ENERGY_LIVES, energyUpdatedAt: Date.now(), version: 7 };
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

function resolveEnergy(save: SaveData, now = Date.now()): SaveData {
  if (save.energyLives >= MAX_ENERGY_LIVES) {
    return { ...save, energyLives: MAX_ENERGY_LIVES, energyUpdatedAt: now };
  }

  const elapsed = Math.max(0, now - save.energyUpdatedAt);
  const refills = Math.floor(elapsed / ENERGY_REFILL_MS);
  if (refills <= 0) return save;

  const energyLives = Math.min(MAX_ENERGY_LIVES, save.energyLives + refills);
  return {
    ...save,
    energyLives,
    energyUpdatedAt: energyLives >= MAX_ENERGY_LIVES
      ? now
      : save.energyUpdatedAt + refills * ENERGY_REFILL_MS,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
interface UseSaveDataReturn {
  loading: boolean;
  unlockedUpTo: number;
  unlockedLevelIds: string[];
  levelStars: Record<number, number>;
  levelHighScores: Record<number, number>;
  totalBobas: number;
  seenWorlds: number[];
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  adsRemoved: boolean;
  seenOnboarding: Record<string, boolean>;
  energyLives: number;
  maxEnergyLives: number;
  nextEnergyInMs: number;
  setAdsRemovedEntitlement: (active: boolean) => void;
  isLevelUnlocked: (levelIndex: number) => boolean;
  spendEnergyLife: () => boolean;
  recordLevelComplete: (levelIndex: number, stars: number, score: number, bricksPopped: number) => void;
  markWorldSeen: (worldIndex: number) => void;
  markOnboardingSeen: (key: string) => void;
  updateSettings: (sound: boolean, haptics: boolean) => void;
}

export function useSaveData(devUnlockAll: boolean, levelIds: string[]): UseSaveDataReturn {
  const [loading, setLoading] = useState(true);
  const [save, setSave] = useState<SaveData>(() => buildDefaultSave(levelIds));
  const [energyNow, setEnergyNow] = useState(Date.now());

  // Keep a ref so callbacks always see latest save without re-creating themselves
  const saveRef = useRef<SaveData>(save);
  saveRef.current = save;

  // ── Load on mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const migrated = resolveEnergy(migrate(parsed, levelIds));
          if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          }
          setSave(migrated);
          saveRef.current = migrated;
        }
      } catch (e) {
        // Corrupt or unreadable save — fall back to defaults silently
        if (__DEV__) console.warn('[SaveData] Failed to load, using defaults:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [levelIds]);

  useEffect(() => {
    const timer = setInterval(() => setEnergyNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Persist helper ──────────────────────────────────────────────────────────
  const persist = useCallback((next: SaveData) => {
    setSave(next);
    saveRef.current = next;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) => {
      if (__DEV__) console.warn('[SaveData] Failed to persist:', e);
    });
  }, []);

  // ── Public action ───────────────────────────────────────────────────────────
  const recordLevelComplete = useCallback((levelIndex: number, stars: number, score: number, bricksPopped: number) => {
    const prev = saveRef.current;
    const levelId = levelIds[levelIndex];
    if (!levelId) return;
    const nextLevelId = levelIds[levelIndex + 1];
    const unlockedLevelIds = new Set(prev.unlockedLevelIds);
    unlockedLevelIds.add(levelId);
    if (nextLevelId) unlockedLevelIds.add(nextLevelId);
    persist({
      ...prev,
      unlockedUpTo: Math.max(prev.unlockedUpTo, levelIndex + 1),
      unlockedLevelIds: Array.from(unlockedLevelIds),
      levelStars: {
        ...prev.levelStars,
        [levelIndex]: Math.max(prev.levelStars[levelIndex] ?? 0, stars),
      },
      levelStarsById: {
        ...prev.levelStarsById,
        [levelId]: Math.max(prev.levelStarsById[levelId] ?? 0, stars),
      },
      levelHighScores: {
        ...prev.levelHighScores,
        [levelIndex]: Math.max(prev.levelHighScores[levelIndex] ?? 0, score),
      },
      levelHighScoresById: {
        ...prev.levelHighScoresById,
        [levelId]: Math.max(prev.levelHighScoresById[levelId] ?? 0, score),
      },
      totalBobas: prev.totalBobas + bricksPopped,
    });
  }, [levelIds, persist]);

  const markWorldSeen = useCallback((worldIndex: number) => {
    const prev = saveRef.current;
    if (prev.seenWorlds.includes(worldIndex)) return;
    persist({ ...prev, seenWorlds: [...prev.seenWorlds, worldIndex] });
  }, [persist]);

  const markOnboardingSeen = useCallback((key: string) => {
    const prev = saveRef.current;
    if (prev.seenOnboarding[key]) return;
    persist({
      ...prev,
      seenOnboarding: {
        ...prev.seenOnboarding,
        [key]: true,
      },
    });
  }, [persist]);

  const updateSettings = useCallback((sound: boolean, haptics: boolean) => {
    persist({ ...saveRef.current, soundEnabled: sound, hapticsEnabled: haptics });
  }, [persist]);

  const setAdsRemovedEntitlement = useCallback((active: boolean) => {
    persist({ ...saveRef.current, adsRemoved: active });
  }, [persist]);

  const spendEnergyLife = useCallback(() => {
    const resolved = resolveEnergy(saveRef.current);
    if (resolved.energyLives <= 0) {
      persist(resolved);
      return false;
    }
    persist({
      ...resolved,
      energyLives: resolved.energyLives - 1,
      energyUpdatedAt: resolved.energyLives >= MAX_ENERGY_LIVES ? Date.now() : resolved.energyUpdatedAt,
    });
    return true;
  }, [persist]);

  // ── Resolved values ─────────────────────────────────────────────────────────
  const levelStars = useMemo(
    () => mapLevelIdsToIndexRecord(save.levelStarsById, levelIds),
    [levelIds, save.levelStarsById],
  );
  const levelHighScores = useMemo(
    () => mapLevelIdsToIndexRecord(save.levelHighScoresById, levelIds),
    [levelIds, save.levelHighScoresById],
  );
  const isLevelUnlocked = useCallback((levelIndex: number) => {
    if (devUnlockAll) return true;
    const levelId = levelIds[levelIndex];
    return Boolean(levelId && saveRef.current.unlockedLevelIds.includes(levelId));
  }, [devUnlockAll, levelIds]);
  const unlockedUpTo = devUnlockAll
    ? levelIds.length - 1
    : levelIds.reduce((highest, levelId, index) => (
        save.unlockedLevelIds.includes(levelId) ? index : highest
      ), 0);
  const resolvedSave = resolveEnergy(save, energyNow);
  const nextEnergyInMs = resolvedSave.energyLives >= MAX_ENERGY_LIVES
    ? 0
    : Math.max(0, ENERGY_REFILL_MS - (energyNow - resolvedSave.energyUpdatedAt));

  return { loading, unlockedUpTo, unlockedLevelIds: save.unlockedLevelIds, levelStars, levelHighScores, totalBobas: save.totalBobas, seenWorlds: save.seenWorlds, soundEnabled: save.soundEnabled, hapticsEnabled: save.hapticsEnabled, adsRemoved: save.adsRemoved, seenOnboarding: save.seenOnboarding, energyLives: resolvedSave.energyLives, maxEnergyLives: MAX_ENERGY_LIVES, nextEnergyInMs, recordLevelComplete, markWorldSeen, markOnboardingSeen, updateSettings, setAdsRemovedEntitlement, isLevelUnlocked, spendEnergyLife };
}
