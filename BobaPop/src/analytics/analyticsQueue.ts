interface QueueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function createAnalyticsQueue<T extends { id: string }>(storage: QueueStorage) {
  const key = '@bobapop_analytics_queue_v1';
  let pending: Promise<unknown> = Promise.resolve();
  let flushing: Promise<void> | null = null;
  let enqueueRevision = 0;
  const serialize = <R>(action: () => Promise<R>): Promise<R> => {
    const result = pending.catch(() => {}).then(action);
    pending = result;
    return result;
  };
  const read = async (): Promise<T[]> => {
    const raw = await storage.getItem(key);
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((event): event is T => !!event && typeof event === 'object' && typeof event.id === 'string') : [];
    } catch { return []; }
  };
  const write = (events: T[]) => storage.setItem(key, JSON.stringify(events.slice(-100)));

  return {
    enqueue(event: T) {
      return serialize(async () => {
        await write([...(await read()), event]);
        enqueueRevision += 1;
      });
    },
    flush(send: (event: T) => Promise<void> | void): Promise<void> {
      if (flushing) return flushing;
      flushing = (async () => {
        // Network work runs outside the storage lock so offline uploads never block enqueues.
        for (;;) {
          const revision = enqueueRevision;
          const events = await serialize(read);
          if (!events.length) return;
          const sent = new Set<string>();
          for (const event of events) {
            try { await send(event); sent.add(event.id); } catch { break; }
          }
          await serialize(async () => write((await read()).filter((event) => !sent.has(event.id))));
          if (sent.size < events.length || revision === enqueueRevision) return;
        }
      })().finally(() => { flushing = null; });
      return flushing;
    },
  };
}
