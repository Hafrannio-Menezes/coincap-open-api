type CacheEntry<TValue> = {
  expiresAt: number;
  value: TValue;
};

export class TtlCache<TKey, TValue> {
  private readonly store = new Map<TKey, CacheEntry<TValue>>();

  get(key: TKey): TValue | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: TKey, value: TValue, ttlMs: number): void {
    this.store.set(key, {
      expiresAt: Date.now() + ttlMs,
      value
    });
  }
}
