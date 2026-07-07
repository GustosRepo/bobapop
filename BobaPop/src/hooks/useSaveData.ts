import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BACKUP_STORAGE_KEY,
  ENERGY_REFILL_MS,
  MAX_ENERGY,
  STORAGE_KEY,
  SaveData,
  buildDefaultSave,
  mapLevelIdsToIndexRecord,
  migrateSaveData,
  resolveEnergy,
} from './saveDataCore';

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
  energy: number;
  maxEnergy: number;
  nextEnergyInMs: number;
  setAdsRemovedEntitlement: (active: boolean) => void;
  isLevelUnlocked: (levelIndex: number) => boolean;
  spendEnergy: () => boolean;
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
          const migrated = resolveEnergy(migrateSaveData(parsed, levelIds));
          if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
            await AsyncStorage.setItem(BACKUP_STORAGE_KEY, raw);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          }
          setSave(migrated);
          saveRef.current = migrated;
        }
      } catch (e) {
        const backupRaw = await AsyncStorage.getItem(BACKUP_STORAGE_KEY).catch(() => null);
        if (backupRaw !== null) {
          try {
            const backupParsed = JSON.parse(backupRaw) as Record<string, unknown>;
            const restored = resolveEnergy(migrateSaveData(backupParsed, levelIds));
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
            setSave(restored);
            saveRef.current = restored;
            if (__DEV__) console.warn('[SaveData] Restored save from backup after primary load failed:', e);
          } catch (backupError) {
            if (__DEV__) console.warn('[SaveData] Failed to load primary and backup saves, using defaults:', e, backupError);
          }
        } else if (__DEV__) {
          console.warn('[SaveData] Failed to load, using defaults:', e);
        }
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

  const spendEnergy = useCallback(() => {
    const resolved = resolveEnergy(saveRef.current);
    if (resolved.energyLives <= 0) {
      persist(resolved);
      return false;
    }
    persist({
      ...resolved,
      energyLives: resolved.energyLives - 1,
      energyUpdatedAt: resolved.energyLives >= MAX_ENERGY ? Date.now() : resolved.energyUpdatedAt,
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
  const nextEnergyInMs = resolvedSave.energyLives >= MAX_ENERGY
    ? 0
    : Math.max(0, ENERGY_REFILL_MS - (energyNow - resolvedSave.energyUpdatedAt));

  return { loading, unlockedUpTo, unlockedLevelIds: save.unlockedLevelIds, levelStars, levelHighScores, totalBobas: save.totalBobas, seenWorlds: save.seenWorlds, soundEnabled: save.soundEnabled, hapticsEnabled: save.hapticsEnabled, adsRemoved: save.adsRemoved, seenOnboarding: save.seenOnboarding, energy: resolvedSave.energyLives, maxEnergy: MAX_ENERGY, nextEnergyInMs, recordLevelComplete, markWorldSeen, markOnboardingSeen, updateSettings, setAdsRemovedEntitlement, isLevelUnlocked, spendEnergy };
}
