import type { PublicProjectionRedisClient } from '../cache/PublicProjectionCache.js';

type StoredValue = {
  value: string;
  expiresAt: number;
};

export class FakeRedisClient implements PublicProjectionRedisClient {
  private readonly store = new Map<string, StoredValue>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async setEx(key: string, ttlSeconds: number, value: string): Promise<'OK'> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        removed += 1;
      }
    }
    return removed;
  }
}
