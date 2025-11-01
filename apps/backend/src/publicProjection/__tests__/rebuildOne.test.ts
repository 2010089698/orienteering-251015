import { describe, expect, it, vi } from 'vitest';

import type { EventDto, EventQueryService } from '@event-management/application';
import type { StartlistDiffDto, StartlistQueryService } from '@startlist-management/application';

import { InMemoryPublicProjectionRepository } from '../InMemoryPublicProjectionRepository.js';
import type { PublicProjectionCache } from '../cache/PublicProjectionCache.js';
import type { PublicProjectionCdnClient } from '../cdn/HttpPublicProjectionCdnClient.js';
import type { PublicProjectionNotifier } from '../rebuildOne.js';
import { ProjectionRebuildError, rebuildPublicProjectionRecord } from '../rebuildOne.js';
import {
  EVENT_ID,
  RACE_ID,
  STARTLIST_ID,
  TIMESTAMP,
  createEventDto,
  createStartlistSnapshot,
} from './fixtures.js';

const createEventWithStartlist = (): EventDto => ({
  ...createEventDto(),
  races: [
    {
      ...createEventDto().races[0],
      startlist: {
        id: STARTLIST_ID,
        status: 'FINALIZED',
        confirmedAt: '2024-01-01T12:00:00.000Z',
        publicVersion: 2,
        publicUrl: 'https://example.test/public/startlists/startlist-xyz',
      },
    },
  ],
});

const createStartlistService = (
  overrides: Partial<StartlistQueryService> = {},
): StartlistQueryService => {
  const snapshot = createStartlistSnapshot('FINALIZED');
  const versions = [
    {
      version: 1,
      snapshot: { ...snapshot, status: 'DRAFT' },
      confirmedAt: '2024-01-01T11:00:00.000Z',
    },
    {
      version: 2,
      snapshot,
      confirmedAt: '2024-01-01T12:00:00.000Z',
    },
  ];

  return {
    execute: vi.fn(async () => structuredClone(snapshot)),
    listVersions: vi.fn(async () => ({
      startlistId: STARTLIST_ID,
      total: versions.length,
      items: versions.map((version) => ({
        version: version.version,
        snapshot: structuredClone(version.snapshot),
        confirmedAt: version.confirmedAt,
      })),
    })),
    diff: vi.fn(async () => undefined),
    ...overrides,
  } satisfies StartlistQueryService;
};

describe('rebuildPublicProjectionRecord', () => {
  it('rebuilds an event and refreshes caches and CDN entries', async () => {
    const repository = new InMemoryPublicProjectionRepository();
    const event = createEventWithStartlist();

    const eventQueryService: EventQueryService = {
      getById: vi.fn(async () => structuredClone(event)),
      listAll: vi.fn(async () => [structuredClone(event)]),
    };

    const startlistQueryService = createStartlistService();

    const invalidate = vi.fn(async () => {});
    const cache = { invalidate } as unknown as PublicProjectionCache;

    const purgePaths = vi.fn(async () => {});
    const cdnClient: PublicProjectionCdnClient = { purgePaths };

    const notify = vi.fn(async () => {});
    const notifier: PublicProjectionNotifier = { notify };

    const result = await rebuildPublicProjectionRecord({
      repository,
      eventQueryService,
      startlistQueryService,
      cache,
      cdnClient,
      notifier,
      eventId: EVENT_ID,
      now: () => new Date('2024-01-01T13:00:00.000Z'),
    });

    expect(result.type).toBe('event');
    expect(result.urls).toEqual([
      `/api/public/events/${EVENT_ID}`,
      `/api/public/events/${EVENT_ID}/races/${RACE_ID}/startlist`,
    ]);
    expect(result.cacheKeys).toEqual([
      { type: 'event', eventId: EVENT_ID },
      { type: 'startlist', eventId: EVENT_ID, raceId: RACE_ID },
    ]);

    expect(invalidate).toHaveBeenCalledWith(result.cacheKeys);
    expect(purgePaths).toHaveBeenCalledWith(result.urls);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'event',
        urls: result.urls,
      }),
    );

    const storedEvent = await repository.findEventById(EVENT_ID);
    expect(storedEvent?.races[0].startlist?.confirmedAt).toBe('2024-01-01T12:00:00.000Z');
    expect(storedEvent?.races[0].startlist?.snapshot.status).toBe('FINALIZED');
  });

  it('throws when the event is missing', async () => {
    const repository = new InMemoryPublicProjectionRepository();

    const eventQueryService: EventQueryService = {
      getById: vi.fn(async () => undefined),
      listAll: vi.fn(async () => []),
    };

    const startlistQueryService = createStartlistService();

    await expect(
      rebuildPublicProjectionRecord({
        repository,
        eventQueryService,
        startlistQueryService,
        eventId: EVENT_ID,
      }),
    ).rejects.toBeInstanceOf(ProjectionRebuildError);
  });

  it('rebuilds a startlist and emits diff information', async () => {
    const repository = new InMemoryPublicProjectionRepository();

    const event = createEventWithStartlist();
    const eventQueryService: EventQueryService = {
      getById: vi.fn(async () => structuredClone(event)),
      listAll: vi.fn(async () => [structuredClone(event)]),
    };

    const diff: StartlistDiffDto = {
      startlistId: STARTLIST_ID,
      to: { version: 2, confirmedAt: '2024-01-01T12:00:00.000Z' },
      from: { version: 1, confirmedAt: '2024-01-01T11:00:00.000Z' },
      changes: {
        status: {
          previous: 'DRAFT',
          current: 'FINALIZED',
        },
      },
    };

    const startlistQueryService = createStartlistService({
      diff: vi.fn(async () => diff),
    });

    const invalidate = vi.fn(async () => {});
    const cache = { invalidate } as unknown as PublicProjectionCache;

    const purgePaths = vi.fn(async () => {});
    const cdnClient: PublicProjectionCdnClient = { purgePaths };

    const notify = vi.fn(async () => {});
    const notifier: PublicProjectionNotifier = { notify };

    const result = await rebuildPublicProjectionRecord({
      repository,
      eventQueryService,
      startlistQueryService,
      cache,
      cdnClient,
      notifier,
      startlistId: STARTLIST_ID,
      now: () => new Date(TIMESTAMP),
    });

    expect(result.type).toBe('startlist');
    expect(result.diff).toEqual(diff);
    expect(invalidate).toHaveBeenCalledWith([
      { type: 'event', eventId: EVENT_ID },
      { type: 'startlist', eventId: EVENT_ID, raceId: RACE_ID },
    ]);
    expect(purgePaths).toHaveBeenCalledWith([
      `/api/public/events/${EVENT_ID}`,
      `/api/public/events/${EVENT_ID}/races/${RACE_ID}/startlist`,
    ]);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'startlist',
        diff,
      }),
    );

    const stored = await repository.findStartlistByRace(EVENT_ID, RACE_ID);
    expect(stored?.history).toHaveLength(2);
  });
});
