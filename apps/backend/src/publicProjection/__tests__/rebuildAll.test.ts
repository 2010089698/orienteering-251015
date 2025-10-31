import { describe, expect, it, vi } from 'vitest';

import type { EventDto, EventQueryService } from '@event-management/application';
import type { StartlistQueryService } from '@startlist-management/application';

import { InMemoryPublicProjectionRepository } from '../InMemoryPublicProjectionRepository.js';
import type { PublicProjectionCache } from '../cache/PublicProjectionCache.js';
import type { PublicProjectionCdnClient } from '../cdn/HttpPublicProjectionCdnClient.js';
import { rebuildPublicProjection, ToleranceExceededError } from '../rebuildAll.js';

const EVENT_ID = 'event-1';
const RACE_ID = 'race-1';
const STARTLIST_ID = 'startlist-1';

const createEventDto = (): EventDto => ({
  id: EVENT_ID,
  name: 'World Orienteering Championship',
  startDate: '2024-07-01T08:00:00.000Z',
  endDate: '2024-07-05T18:00:00.000Z',
  venue: 'Forest Arena',
  allowMultipleRacesPerDay: true,
  allowScheduleOverlap: true,
  races: [
    {
      id: RACE_ID,
      name: 'Sprint Qualifier',
      schedule: { start: '2024-07-02T09:00:00.000Z' },
      duplicateDay: false,
      overlapsExisting: false,
      startlist: {
        id: STARTLIST_ID,
        status: 'FINAL',
        confirmedAt: '2024-07-02T12:00:00.000Z',
        publicVersion: 2,
        publicUrl: 'https://example.test/public/startlists/startlist-1',
      },
    },
  ],
});

const createStartlistSnapshot = () => ({
  id: STARTLIST_ID,
  eventId: EVENT_ID,
  raceId: RACE_ID,
  status: 'FINAL',
  settings: {
    eventId: EVENT_ID,
    startTime: '2024-07-02T09:00:00.000Z',
    laneCount: 4,
    intervals: {
      laneClass: { milliseconds: 60000 },
      classPlayer: { milliseconds: 30000 },
    },
  },
  laneAssignments: [],
  classAssignments: [],
  startTimes: [],
});

const createStartlistQueryService = (): StartlistQueryService => {
  const snapshot = createStartlistSnapshot();
  const versions = [
    {
      version: 1,
      snapshot: { ...snapshot, status: 'DRAFT' },
      confirmedAt: '2024-07-02T10:00:00.000Z',
    },
    {
      version: 2,
      snapshot,
      confirmedAt: '2024-07-02T12:00:00.000Z',
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
  } satisfies StartlistQueryService;
};

const createEventQueryService = (event: EventDto): EventQueryService => ({
  listAll: vi.fn(async () => [structuredClone(event)]),
  getById: vi.fn(async () => structuredClone(event)),
});

describe('rebuildPublicProjection', () => {
  it('rebuilds the public projection and refreshes caches', async () => {
    const repository = new InMemoryPublicProjectionRepository();
    const event = createEventDto();
    const eventQueryService = createEventQueryService(event);
    const startlistQueryService = createStartlistQueryService();

    const invalidate = vi.fn(async () => {});
    const cache = {
      getEvent: vi.fn(async () => undefined),
      setEvent: vi.fn(async () => undefined),
      getStartlist: vi.fn(async () => undefined),
      setStartlist: vi.fn(async () => undefined),
      invalidate,
    } as unknown as PublicProjectionCache;

    const purgePaths = vi.fn(async () => {});
    const cdnClient: PublicProjectionCdnClient = { purgePaths };

    const result = await rebuildPublicProjection({
      repository,
      eventQueryService,
      startlistQueryService,
      cache,
      cdnClient,
      now: () => new Date('2024-07-02T13:00:00.000Z'),
    });

    expect(result.after.eventCount).toBe(1);
    expect(result.after.raceCount).toBe(1);
    expect(result.after.startlistCount).toBe(1);
    expect(result.after.versionCount).toBe(2);
    expect(result.diff.counts).toEqual({
      eventCount: 1,
      raceCount: 1,
      startlistCount: 1,
      versionCount: 2,
    });
    expect(result.diff.urls.added).toEqual([
      `/api/public/events/${EVENT_ID}`,
      `/api/public/events/${EVENT_ID}/races/${RACE_ID}/startlist`,
    ]);

    const startlistDetails = await repository.findStartlistByRace(EVENT_ID, RACE_ID);
    expect(startlistDetails?.history).toHaveLength(2);
    expect(startlistDetails?.history[0].version).toBe(1);
    expect(startlistDetails?.history[1].version).toBe(2);

    expect(invalidate).toHaveBeenCalledWith([
      { type: 'event', eventId: EVENT_ID },
      { type: 'startlist', eventId: EVENT_ID, raceId: RACE_ID },
    ]);
    expect(purgePaths).toHaveBeenCalledWith([
      `/api/public/events/${EVENT_ID}`,
      `/api/public/events/${EVENT_ID}/races/${RACE_ID}/startlist`,
    ]);
  });

  it('throws when tolerances are exceeded and aborting is enabled', async () => {
    const repository = new InMemoryPublicProjectionRepository();
    const eventQueryService = createEventQueryService(createEventDto());
    const startlistQueryService = createStartlistQueryService();

    const invalidate = vi.fn(async () => {});
    const cache = {
      getEvent: vi.fn(async () => undefined),
      setEvent: vi.fn(async () => undefined),
      getStartlist: vi.fn(async () => undefined),
      setStartlist: vi.fn(async () => undefined),
      invalidate,
    } as unknown as PublicProjectionCache;

    await expect(
      rebuildPublicProjection({
        repository,
        eventQueryService,
        startlistQueryService,
        cache,
        tolerance: { eventCount: 0, raceCount: 0, startlistCount: 0, versionCount: 0 },
      }),
    ).rejects.toBeInstanceOf(ToleranceExceededError);

    expect(invalidate).toHaveBeenCalled();
  });

  it('continues when tolerances are exceeded but aborting is disabled', async () => {
    const repository = new InMemoryPublicProjectionRepository();
    const eventQueryService = createEventQueryService(createEventDto());
    const startlistQueryService = createStartlistQueryService();

    const result = await rebuildPublicProjection({
      repository,
      eventQueryService,
      startlistQueryService,
      tolerance: { eventCount: 0, raceCount: 0, startlistCount: 0, versionCount: 0 },
      abortOnToleranceViolation: false,
    });

    expect(result.violations).not.toHaveLength(0);
    expect(result.after.eventCount).toBe(1);
  });
});
