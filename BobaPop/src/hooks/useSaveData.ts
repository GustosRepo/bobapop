import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { BADGE_STYLES, BadgeStyleId, getBadgeStyle, isBadgeUnlocked } from '../game/badgeRewards';
import { createSaveWriter, loadSavedProgress } from './saveStorage';
import { CompletionReward, EnergyGrant, FIRST_CLEAR_ENERGY_REFUND, hasUnlimitedEnergy } from '../monetization/economy';
import {
  ENERGY_REFILL_MS,
  MAX_ENERGY,
  SaveData,
  buildDefaultSave,
  mapLevelIdsToIndexRecord,
  resolveEnergy,
} from './saveDataCore';

// ─── Hook ─────────────────────────────────────────────────────────────────────
interface UseSaveDataReturn {
  loading: boolean;
  ready: boolean;
  saveError: string | null;
  retrySave: () => void;
  unlockedUpTo: number;
  unlockedLevelIds: string[];
  levelStars: Record<number, number>;
  levelHighScores: Record<number, number>;
  totalBobas: number;
  selectedBadgeId: BadgeStyleId;
  selectBadge: (id: BadgeStyleId) => boolean;
  seenWorlds: number[];
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  adsRemoved: boolean;
  seenOnboarding: Record<string, boolean>;
  energy: number;
  maxEnergy: number;
  nextEnergyInMs: number;
  setAdsRemovedEntitlement: (active: boolean, expiresAt?: number | null) => void;
  isLevelUnlocked: (levelIndex: number) => boolean;
  spendEnergy: () => boolean;
  addEnergy: (amount?: number) => EnergyGrant;
  recordLevelComplete: (levelIndex: number, stars: number, score: number, bricksPopped: number) => CompletionReward;
  claimClearBonus: (claimId: string) => { added: number; badgeUnlocks: string[] };
  markWorldSeen: (worldIndex: number) => void;
  markOnboardingSeen: (key: string) => void;
  updateSettings: (sound: boolean, haptics: boolean) => void;
}

export function useSaveData(devUnlockAll: boolean, levelIds: string[]): UseSaveDataReturn {
  const [loading, setLoading] = useState(true);
  const [save, setSave] = useState<SaveData>(() => buildDefaultSave(levelIds));
  const [energyNow, setEnergyNow] = useState(Date.now());

  const saveRef = useRef<SaveData>(save);
  const hydratedRef = useRef(false);
  const pendingEntitlementRef = useRef<{ active: boolean; expiresAt: number | null } | null>(null);
  const writer = useMemo(() => createSaveWriter(AsyncStorage), []);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const persist = useCallback((next: SaveData) => {
    if (!hydratedRef.current) return;
    saveRef.current = next;
    setSave(next);
    writer(next).then(() => setSaveError(null)).catch(() => {
      setSaveError('Progress could not be saved. Keep BobaPop open and tap Retry.');
    });
  }, [writer]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSavedProgress(AsyncStorage, levelIds).then(({ save: loaded }) => {
      if (cancelled) return;
      const entitlement = pendingEntitlementRef.current;
      pendingEntitlementRef.current = null;
      hydratedRef.current = true;
      persist(entitlement === null ? loaded : { ...loaded, adsRemoved: entitlement.active, plusExpiresAt: entitlement.expiresAt });
    }).catch((error) => {
      if (!cancelled) setSaveError(error instanceof Error ? error.message : 'Progress could not be loaded. Please retry.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [levelIds, loadAttempt, persist]);

  const retrySave = useCallback(() => {
    if (hydratedRef.current) persist(saveRef.current);
    else setLoadAttempt((attempt) => attempt + 1);
  }, [persist]);

  useEffect(() => {
    const timer = setInterval(() => setEnergyNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setEnergyNow(Date.now());
    });
    return () => { clearInterval(timer); sub.remove(); };
  }, []);

  // ── Public action ───────────────────────────────────────────────────────────
  const recordLevelComplete = useCallback((levelIndex: number, stars: number, score: number, bricksPopped: number) => {
    const prev = resolveEnergy(saveRef.current);
    const levelId = levelIds[levelIndex];
    if (!hydratedRef.current || !levelId) return { firstClear: false, energyRefund: 0, badgeUnlocks: [], bobasEarned: 0, bonusClaimId: null };
    const bobasEarned = Number.isFinite(bricksPopped) ? Math.max(0, Math.min(1000, Math.floor(bricksPopped))) : 0;
    const bonusClaimId = levelIndex >= 3 && bobasEarned > 0 ? `${Date.now()}_${Math.random().toString(36).slice(2, 10)}` : null;
    const firstClear = (prev.levelStarsById[levelId] ?? 0) === 0;
    const energyRefund = firstClear && !hasUnlimitedEnergy(prev)
      ? Math.min(FIRST_CLEAR_ENERGY_REFUND, MAX_ENERGY - prev.energyLives) : 0;
    const energyLives = prev.energyLives + energyRefund;
    const previousStars = levelIds.reduce((total, id) => total + (prev.levelStarsById[id] ?? 0), 0);
    const nextStars = previousStars + Math.max(0, stars - (prev.levelStarsById[levelId] ?? 0));
    const badgeUnlocks = BADGE_STYLES.filter((badge) => !isBadgeUnlocked(badge, previousStars, prev.totalBobas)
      && isBadgeUnlocked(badge, nextStars, prev.totalBobas + bobasEarned)).map((badge) => badge.name);
    const nextLevelId = levelIds[levelIndex + 1];
    const unlockedLevelIds = new Set(prev.unlockedLevelIds);
    unlockedLevelIds.add(levelId);
    if (nextLevelId) unlockedLevelIds.add(nextLevelId);
    persist({
      ...prev,
      energyLives,
      energyUpdatedAt: energyLives >= MAX_ENERGY ? Date.now() : prev.energyUpdatedAt,
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
      totalBobas: prev.totalBobas + bobasEarned,
      pendingClearBonus: bonusClaimId ? { id: bonusClaimId, bobas: bobasEarned } : null,
    });
    return { firstClear, energyRefund, badgeUnlocks, bobasEarned, bonusClaimId };
  }, [levelIds, persist]);

  const claimClearBonus = useCallback((claimId: string) => {
    const prev = saveRef.current;
    const bonus = prev.pendingClearBonus;
    if (!hydratedRef.current || !bonus || bonus.id !== claimId) return { added: 0, badgeUnlocks: [] };
    const totalBobas = prev.totalBobas + bonus.bobas;
    const stars = levelIds.reduce((total, id) => total + (prev.levelStarsById[id] ?? 0), 0);
    const badgeUnlocks = BADGE_STYLES.filter((badge) => !isBadgeUnlocked(badge, stars, prev.totalBobas)
      && isBadgeUnlocked(badge, stars, totalBobas)).map((badge) => badge.name);
    // persist updates saveRef synchronously, so duplicate SDK callbacks cannot claim twice.
    persist({ ...prev, totalBobas, pendingClearBonus: null });
    return { added: bonus.bobas, badgeUnlocks };
  }, [levelIds, persist]);

  const selectBadge = useCallback((id: BadgeStyleId) => {
    if (!hydratedRef.current) return false;
    const prev = saveRef.current;
    const stars = levelIds.reduce((total, levelId) => total + (prev.levelStarsById[levelId] ?? 0), 0);
    const badge = getBadgeStyle(id, stars, prev.totalBobas);
    if (badge.id !== id) return false;
    persist({ ...prev, selectedBadgeId: id });
    return true;
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

  const setAdsRemovedEntitlement = useCallback((active: boolean, expiresAt: number | null = null) => {
    if (!hydratedRef.current) {
      pendingEntitlementRef.current = { active, expiresAt };
      return;
    }
    if (saveRef.current.adsRemoved !== active || saveRef.current.plusExpiresAt !== expiresAt) {
      persist({ ...saveRef.current, adsRemoved: active, plusExpiresAt: expiresAt });
    }
  }, [persist]);

  const spendEnergy = useCallback(() => {
    if (!hydratedRef.current) return false;
    const resolved = resolveEnergy(saveRef.current);
    if (hasUnlimitedEnergy(resolved)) return true;
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

  const addEnergy = useCallback((amount = 1): EnergyGrant => {
    const resolved = resolveEnergy(saveRef.current);
    const noGrant = { added: 0, energyBefore: resolved.energyLives, energyAfter: resolved.energyLives };
    if (!hydratedRef.current || !Number.isFinite(amount) || amount < 1) return noGrant;
    const energyLives = Math.min(MAX_ENERGY, resolved.energyLives + Math.floor(amount));
    persist({
      ...resolved,
      energyLives,
      energyUpdatedAt: energyLives >= MAX_ENERGY ? Date.now() : resolved.energyUpdatedAt,
    });
    return { added: energyLives - resolved.energyLives, energyBefore: resolved.energyLives, energyAfter: energyLives };
  }, [persist]);

  useEffect(() => {
    if (save.adsRemoved && save.plusExpiresAt !== null && save.plusExpiresAt <= energyNow) {
      setAdsRemovedEntitlement(false);
    }
  }, [energyNow, save.adsRemoved, save.plusExpiresAt, setAdsRemovedEntitlement]);

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

  return { loading, ready: hydratedRef.current, saveError, retrySave, unlockedUpTo, unlockedLevelIds: save.unlockedLevelIds, levelStars, levelHighScores, totalBobas: save.totalBobas, selectedBadgeId: save.selectedBadgeId, selectBadge, seenWorlds: save.seenWorlds, soundEnabled: save.soundEnabled, hapticsEnabled: save.hapticsEnabled, adsRemoved: hasUnlimitedEnergy(save, Math.max(energyNow, Date.now())), seenOnboarding: save.seenOnboarding, energy: resolvedSave.energyLives, maxEnergy: MAX_ENERGY, nextEnergyInMs, recordLevelComplete, claimClearBonus, markWorldSeen, markOnboardingSeen, updateSettings, setAdsRemovedEntitlement, isLevelUnlocked, spendEnergy, addEnergy };
}
