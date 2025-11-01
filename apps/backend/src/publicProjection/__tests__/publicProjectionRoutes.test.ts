import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import type { EventDto, EventQueryService } from '@event-management/application';
import type { StartlistDiffDto, StartlistQueryService } from '@startlist-management/application';

import { publicProjectionRoutes } from '../routes.js';
import type { PublicProjectionRepository } from '../repository.js';
import type { PublicEventView, PublicStartlistDetails } from '../models.js';
import { PublicProjectionCache } from '../cache/PublicProjectionCache.js';
import type { PublicProjectionNotifier } from '../rebuildOne.js';
import type { PublicProjectionCdnClient } from '../cdn/HttpPublicProjectionCdnClient.js';
import { InMemoryPublicProjectionRepository } from '../InMemoryPublicProjectionRepository.js';
import { FakeRedisClient } from './FakeRedisClient.js';
import {
  EVENT_ID,
  RACE_ID,
  STARTLIST_ID,
  TIMESTAMP,
  buildEventDto,
  createStartlistSnapshot,
} from './fixtures.js';

const createNoopEventQueryService = (): EventQueryService => ({
  getById: vi.fn(async () => undefined),
  listAll: vi.fn(async () => []),
});

const createNoopStartlistQueryService = (): StartlistQueryService => ({
  execute: vi.fn(async () => createStartlistSnapshot()),
  listVersions: vi.fn(async () => ({ startlistId: STARTLIST_ID, total: 0, items: [] })),
  diff: vi.fn(async () => undefined),
});

const createEventWithStartlist = (): EventDto => ({
  ...buildEventDto(),
  races: [
    {
      ...buildEventDto().races[0],
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

describe('publicProjectionRoutes', () => {
  it('reads and writes event data via cache', async () => {
    const cache = new PublicProjectionCache(new FakeRedisClient());
    const event: PublicEventView = {
      id: EVENT_ID,
      name: 'Orienteering Cup',
      startDate: TIMESTAMP,
      endDate: TIMESTAMP,
      venue: 'Forest Arena',
      allowMultipleRacesPerDay: true,
      allowScheduleOverlap: true,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      races: buildEventDto().races.map((race) => ({
        id: race.id,
        eventId: EVENT_ID,
        name: race.name,
        schedule: race.schedule,
        duplicateDay: race.duplicateDay,
        overlapsExisting: race.overlapsExisting,
        startlistId: undefined,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      })),
    };

    const repository: PublicProjectionRepository = {
      upsertEvent: vi.fn(),
      upsertRace: vi.fn(),
      upsertStartlist: vi.fn(),
      appendStartlistVersion: vi.fn(),
      replaceStartlistHistory: vi.fn(),
      listEvents: vi.fn(),
      findEventById: vi.fn().mockResolvedValueOnce(event),
      findStartlistByRace: vi.fn(),
    };

    const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();
    await app.register(publicProjectionRoutes, {
      repository,
      cache,
      eventQueryService: createNoopEventQueryService(),
      startlistQueryService: createNoopStartlistQueryService(),
    });

    const firstResponse = await app.inject({
      method: 'GET',
      url: `/api/public/events/${EVENT_ID}`,
    });
    expect(firstResponse.statusCode).toBe(200);
    expect(repository.findEventById).toHaveBeenCalledTimes(1);

    const secondResponse = await app.inject({
      method: 'GET',
      url: `/api/public/events/${EVENT_ID}`,
    });
    expect(secondResponse.statusCode).toBe(200);
    expect(repository.findEventById).toHaveBeenCalledTimes(1);
    expect(await cache.getEvent(EVENT_ID)).toEqual(event);

    await app.close();
  });

  it('reads and writes startlist data via cache', async () => {
    const cache = new PublicProjectionCache(new FakeRedisClient());
    const startlistSnapshot = createStartlistSnapshot('FINALIZED');
    const startlistDetails: PublicStartlistDetails = {
      startlist: {
        id: STARTLIST_ID,
        eventId: EVENT_ID,
        raceId: RACE_ID,
        status: 'FINALIZED',
        snapshot: startlistSnapshot,
        confirmedAt: TIMESTAMP,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      history: [],
    };

    const repository: PublicProjectionRepository = {
      upsertEvent: vi.fn(),
      upsertRace: vi.fn(),
      upsertStartlist: vi.fn(),
      appendStartlistVersion: vi.fn(),
      replaceStartlistHistory: vi.fn(),
      listEvents: vi.fn(),
      findEventById: vi.fn(),
      findStartlistByRace: vi.fn().mockResolvedValueOnce(startlistDetails),
    };

    const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();
    await app.register(publicProjectionRoutes, {
      repository,
      cache,
      eventQueryService: createNoopEventQueryService(),
      startlistQueryService: createNoopStartlistQueryService(),
    });

    const firstResponse = await app.inject({
      method: 'GET',
      url: `/api/public/events/${EVENT_ID}/races/${RACE_ID}/startlist`,
    });
    expect(firstResponse.statusCode).toBe(200);
    expect(repository.findStartlistByRace).toHaveBeenCalledTimes(1);

    const secondResponse = await app.inject({
      method: 'GET',
      url: `/api/public/events/${EVENT_ID}/races/${RACE_ID}/startlist`,
    });
    expect(secondResponse.statusCode).toBe(200);
    expect(repository.findStartlistByRace).toHaveBeenCalledTimes(1);
    expect(await cache.getStartlist(EVENT_ID, RACE_ID)).toEqual(startlistDetails);

    await app.close();
  });

  it('rebuilds a startlist via the rebuild endpoint', async () => {
    const cache = new PublicProjectionCache(new FakeRedisClient());
    const repository = new InMemoryPublicProjectionRepository();
    const event = createEventWithStartlist();

    const eventQueryService: EventQueryService = {
      getById: vi.fn(async () => structuredClone(event)),
      listAll: vi.fn(async () => [structuredClone(event)]),
    };

    const snapshot = createStartlistSnapshot('FINALIZED');
    const diff: StartlistDiffDto = {
      startlistId: STARTLIST_ID,
      to: { version: 2, confirmedAt: '2024-01-01T12:00:00.000Z' },
      from: { version: 1, confirmedAt: '2024-01-01T11:00:00.000Z' },
      changes: { status: { previous: 'DRAFT', current: 'FINALIZED' } },
    };

    const startlistQueryService: StartlistQueryService = {
      execute: vi.fn(async () => structuredClone(snapshot)),
      listVersions: vi.fn(async () => ({
        startlistId: STARTLIST_ID,
        total: 2,
        items: [
          { version: 1, snapshot: { ...snapshot, status: 'DRAFT' }, confirmedAt: '2024-01-01T11:00:00.000Z' },
          { version: 2, snapshot: structuredClone(snapshot), confirmedAt: '2024-01-01T12:00:00.000Z' },
        ],
      })),
      diff: vi.fn(async () => diff),
    };

    const notify = vi.fn(async () => {});
    const notifier: PublicProjectionNotifier = { notify };

    const purgePaths = vi.fn(async () => {});
    const cdnClient: PublicProjectionCdnClient = { purgePaths };

    const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();
    await app.register(publicProjectionRoutes, {
      repository,
      cache,
      eventQueryService,
      startlistQueryService,
      notifier,
      cdnClient,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/public/projection/rebuild',
      payload: { startlistId: STARTLIST_ID },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { result: { type: string; diff?: unknown }; cacheKeys: unknown[] };
    expect(body.result.type).toBe('startlist');
    expect(body.result.diff).toEqual(diff);
    expect(body.cacheKeys).toEqual([
      { type: 'event', eventId: EVENT_ID },
      { type: 'startlist', eventId: EVENT_ID, raceId: RACE_ID },
    ]);
    expect(notify).toHaveBeenCalled();
    expect(purgePaths).toHaveBeenCalled();

    await app.close();
  });

  it('returns 400 when neither identifier is provided', async () => {
    const cache = new PublicProjectionCache(new FakeRedisClient());
    const repository = new InMemoryPublicProjectionRepository();

    const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();
    await app.register(publicProjectionRoutes, {
      repository,
      cache,
      eventQueryService: createNoopEventQueryService(),
      startlistQueryService: createNoopStartlistQueryService(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/public/projection/rebuild',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
