import type { PublicEventView, PublicStartlistDetails } from '../models.js';

export type PublicProjectionRedisClient = {
  get(key: string): Promise<string | null>;
  setEx(key: string, ttlSeconds: number, value: string): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
};

export type PublicProjectionCacheKey =
  | { type: 'event'; eventId: string }
  | { type: 'startlist'; eventId: string; raceId: string };

export interface PublicProjectionCacheOptions {
  prefix?: string;
  ttlSeconds?: number;
}

const DEFAULT_TTL_SECONDS = 60 * 20; // 20 minutes
const MIN_TTL_SECONDS = 60 * 15;
const MAX_TTL_SECONDS = 60 * 30;
const DEFAULT_PREFIX = 'publicProjection';

export class PublicProjectionCache {
  private readonly client: PublicProjectionRedisClient;
  private readonly ttlSeconds: number;
  private readonly prefix: string;

  constructor(client: PublicProjectionRedisClient, options: PublicProjectionCacheOptions = {}) {
    this.client = client;
    this.ttlSeconds = this.normalizeTtl(options.ttlSeconds ?? DEFAULT_TTL_SECONDS);
    this.prefix = options.prefix ?? DEFAULT_PREFIX;
  }

  async getEvent(eventId: string): Promise<PublicEventView | undefined> {
    const cached = await this.client.get(this.eventKey(eventId));
    return this.parseJson<PublicEventView>(cached);
  }

  async setEvent(event: PublicEventView): Promise<void> {
    await this.client.setEx(this.eventKey(event.id), this.ttlSeconds, JSON.stringify(event));
  }

  async getStartlist(eventId: string, raceId: string): Promise<PublicStartlistDetails | undefined> {
    const cached = await this.client.get(this.startlistKey(eventId, raceId));
    return this.parseJson<PublicStartlistDetails>(cached);
  }

  async setStartlist(eventId: string, raceId: string, details: PublicStartlistDetails): Promise<void> {
    await this.client.setEx(this.startlistKey(eventId, raceId), this.ttlSeconds, JSON.stringify(details));
  }

  async invalidate(keys: PublicProjectionCacheKey[]): Promise<void> {
    if (!keys.length) {
      return;
    }

    const redisKeys = keys.map((key) => this.serializeKey(key));
    await this.client.del(...redisKeys);
  }

  private serializeKey(key: PublicProjectionCacheKey): string {
    if (key.type === 'event') {
      return this.eventKey(key.eventId);
    }
    return this.startlistKey(key.eventId, key.raceId);
  }

  private eventKey(eventId: string): string {
    return `${this.prefix}:event:${eventId}`;
  }

  private startlistKey(eventId: string, raceId: string): string {
    return `${this.prefix}:startlist:${eventId}:${raceId}`;
  }

  private parseJson<T>(payload: string | null): T | undefined {
    if (!payload) {
      return undefined;
    }

    try {
      return JSON.parse(payload) as T;
    } catch (error) {
      return undefined;
    }
  }

  private normalizeTtl(ttlSeconds: number): number {
    if (ttlSeconds < MIN_TTL_SECONDS) {
      return MIN_TTL_SECONDS;
    }
    if (ttlSeconds > MAX_TTL_SECONDS) {
      return MAX_TTL_SECONDS;
    }
    return ttlSeconds;
  }
}
