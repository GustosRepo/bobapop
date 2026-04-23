import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Save format versioning ────────────────────────────────────────────────────
//  Bump CURRENT_VERSION whenever SaveData gains new required fields.
//  Add a migration case below so old saves are upgraded rather than wiped.
const CURRENT_VERSION = 6;
const STORAGE_KEY = '@bobapop_save_v1';   // key never changes; version lives inside the JSON

export interface SaveData {
  version: number;
  unlockedUpTo: number;
  levelStars: Record<number, number>;      // levelIndex → best stars (0–3)
  levelHighScores: Record<number, number>; // levelIndex → best score
  totalBobas: number;                      // lifetime brick pop count
  seenWorlds: number[];                    // world indices whose intro has been shown
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  adsRemoved: boolean;
  seenOnboarding: Record<string, boolean>;
}

const DEFAULT_SAVE: SaveData = {
  version: CURRENT_VERSION,
  unlockedUpTo: 0,
  levelStars: {},
  levelHighScores: {},
  totalBobas: 0,
  seenWorlds: [],
  soundEnabled: true,
  hapticsEnabled: true,
  adsRemoved: false,
  seenOnboarding: {},
};

// ─── Migration table ──────────────────────────────────────────────────────────
// Each function receives the raw parsed object and returns a migrated SaveData.
// Add one entry per version bump.
function migrate(raw: Record<string, unknown>): SaveData {
  let data = { ...raw } as unknown as SaveData;

  // v0 → v1: levelStars may be missing
  if (!data.version || data.version < 1) {
    data = {
      ...DEFAULT_SAVE,
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

  return data;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
interface UseSaveDataReturn {
  loading: boolean;
  unlockedUpTo: number;
  levelStars: Record<number, number>;
  levelHighScores: Record<number, number>;
  totalBobas: number;
  seenWorlds: number[];
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  adsRemoved: boolean;
  seenOnboarding: Record<string, boolean>;
  unlockAdsRemoved: () => void;
  recordLevelComplete: (levelIndex: number, stars: number, score: number, bricksPopped: number) => void;
  markWorldSeen: (worldIndex: number) => void;
  markOnboardingSeen: (key: string) => void;
  updateSettings: (sound: boolean, haptics: boolean) => void;
}

export function useSaveData(devUnlockAll: boolean, totalLevels: number): UseSaveDataReturn {
  const [loading, setLoading] = useState(true);
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);

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
          const migrated = migrate(parsed);
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
    persist({
      ...prev,
      unlockedUpTo: Math.max(prev.unlockedUpTo, levelIndex + 1),
      levelStars: {
        ...prev.levelStars,
        [levelIndex]: Math.max(prev.levelStars[levelIndex] ?? 0, stars),
      },
      levelHighScores: {
        ...prev.levelHighScores,
        [levelIndex]: Math.max(prev.levelHighScores[levelIndex] ?? 0, score),
      },
      totalBobas: prev.totalBobas + bricksPopped,
    });
  }, [persist]);

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

  const unlockAdsRemoved = useCallback(() => {
    persist({ ...saveRef.current, adsRemoved: true });
  }, [persist]);

  // ── Resolved values ─────────────────────────────────────────────────────────
  const unlockedUpTo = devUnlockAll ? totalLevels - 1 : save.unlockedUpTo;

  return { loading, unlockedUpTo, levelStars: save.levelStars, levelHighScores: save.levelHighScores, totalBobas: save.totalBobas, seenWorlds: save.seenWorlds, soundEnabled: save.soundEnabled, hapticsEnabled: save.hapticsEnabled, adsRemoved: save.adsRemoved, seenOnboarding: save.seenOnboarding, recordLevelComplete, markWorldSeen, markOnboardingSeen, updateSettings, unlockAdsRemoved };
}
