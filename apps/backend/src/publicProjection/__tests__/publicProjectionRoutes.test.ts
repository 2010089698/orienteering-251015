import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { publicProjectionRoutes } from '../routes.js';
import type { PublicProjectionRepository } from '../repository.js';
import type { PublicEventView, PublicStartlistDetails } from '../models.js';
import { PublicProjectionCache } from '../cache/PublicProjectionCache.js';
import { FakeRedisClient } from './FakeRedisClient.js';
import {
  EVENT_ID,
  RACE_ID,
  STARTLIST_ID,
  TIMESTAMP,
  buildEventDto,
  createStartlistSnapshot,
} from './fixtures.js';

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
      listEvents: vi.fn(),
      findEventById: vi.fn().mockResolvedValueOnce(event),
      findStartlistByRace: vi.fn(),
    };

    const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();
    await app.register(publicProjectionRoutes, { repository, cache });

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
      listEvents: vi.fn(),
      findEventById: vi.fn(),
      findStartlistByRace: vi.fn().mockResolvedValueOnce(startlistDetails),
    };

    const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();
    await app.register(publicProjectionRoutes, { repository, cache });

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
});
