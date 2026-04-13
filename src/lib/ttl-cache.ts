type CacheEntry<TValue> = {
  expiresAt: number;
  value: TValue;
};

type TtlCacheOptions = {
  maxEntries: number;
};

export class TtlCache<TKey, TValue> {
  private readonly store = new Map<TKey, CacheEntry<TValue>>();
  private readonly maxEntries: number;

  constructor(options: TtlCacheOptions) {
    this.maxEntries = options.maxEntries;
  }

  get(key: TKey): TValue | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    // Refresh recency for LRU behavior.
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value;
  }

  set(key: TKey, value: TValue, ttlMs: number): void {
    if (ttlMs <= 0) {
      this.store.delete(key);
      return;
    }

    this.pruneExpired();

    if (this.store.has(key)) {
      this.store.delete(key);
    }

    this.store.set(key, {
      expiresAt: Date.now() + ttlMs,
      value
    });

    this.enforceLimit();
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private enforceLimit(): void {
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value as TKey | undefined;
      if (oldestKey === undefined) {
        break;
      }

      this.store.delete(oldestKey);
    }
  }
}
