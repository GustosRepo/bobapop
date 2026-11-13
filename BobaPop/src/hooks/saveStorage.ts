import {
  BACKUP_STORAGE_KEY, STORAGE_KEY, SaveData, UnsupportedSaveVersionError,
  buildDefaultSave, migrateSaveData, resolveEnergy,
} from './saveDataCore';

export interface SaveStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export async function loadSavedProgress(storage: SaveStorage, levelIds: string[]) {
  const parse = (raw: string) => resolveEnergy(migrateSaveData(JSON.parse(raw), levelIds));
  const raw = await storage.getItem(STORAGE_KEY);
  try {
    if (raw !== null) return { save: parse(raw), recovered: false };
  } catch (error) {
    if (error instanceof UnsupportedSaveVersionError) throw error;
    const backup = await storage.getItem(BACKUP_STORAGE_KEY);
    if (backup !== null) return { save: parse(backup), recovered: true };
    throw new Error('Saved progress could not be read. Your stored data has been kept. Please retry.');
  }
  const backup = await storage.getItem(BACKUP_STORAGE_KEY);
  return backup !== null
    ? { save: parse(backup), recovered: true }
    : { save: buildDefaultSave(levelIds), recovered: false };
}

// Serialize both copies so an older asynchronous write cannot replace newer progress.
export function createSaveWriter(storage: SaveStorage) {
  let pending = Promise.resolve();
  return (save: SaveData) => {
    const raw = JSON.stringify(save);
    const write = pending.catch(() => {}).then(async () => {
      await storage.setItem(STORAGE_KEY, raw);
      await storage.setItem(BACKUP_STORAGE_KEY, raw);
    });
    pending = write;
    return write;
  };
}
