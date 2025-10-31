import { describe, expect, it, vi } from 'vitest';
import { EventCreated, EventId } from '@event-management/domain';
import { StartlistFinalizedEvent } from '@startlist-management/domain';

import { InMemoryPublicProjectionRepository } from '../InMemoryPublicProjectionRepository.js';
import { PublicProjectionSubscriber } from '../PublicProjectionSubscriber.js';
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

function createSubscriber(overrides: Partial<ReturnType<typeof createServices>> = {}) {
  const services = { ...createServices(), ...overrides };
  return new PublicProjectionSubscriber({
    repository: services.repository,
    eventQueryService: services.eventQueryService,
    startlistQueryService: services.startlistQueryService,
    cache: services.cache,
    cdnClient: services.cdnClient,
  });
}

function createServices() {
  const repository = new InMemoryPublicProjectionRepository();
  const cache = new PublicProjectionCache(new FakeRedisClient());
  const eventQueryService = {
    getById: vi.fn().mockResolvedValue(buildEventDto()),
  };
  const startlistQueryService = {
    execute: vi.fn().mockResolvedValue(createStartlistSnapshot('FINALIZED')),
  };
  const cdnClient = {
    purgePaths: vi.fn().mockResolvedValue(undefined),
  };

  return { repository, cache, eventQueryService, startlistQueryService, cdnClient } as const;
}

describe('PublicProjectionCache integration', () => {
  it('invalidates cache entries and purges CDN paths after projection writes', async () => {
    const services = createServices();
    const subscriber = createSubscriber(services);

    const staleEvent = buildEventDto();
    await services.cache.setEvent({
      id: staleEvent.id,
      name: staleEvent.name,
      startDate: staleEvent.startDate,
      endDate: staleEvent.endDate,
      venue: staleEvent.venue,
      allowMultipleRacesPerDay: staleEvent.allowMultipleRacesPerDay,
      allowScheduleOverlap: staleEvent.allowScheduleOverlap,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      races: [],
    });

    await subscriber.handle(new EventCreated(EventId.from(EVENT_ID)));

    expect(await services.cache.getEvent(EVENT_ID)).toBeUndefined();
    expect(services.cdnClient.purgePaths).toHaveBeenCalledWith([
      `/api/public/events/${EVENT_ID}`,
    ]);

    const staleStartlist = {
      startlist: {
        id: STARTLIST_ID,
        eventId: EVENT_ID,
        raceId: RACE_ID,
        status: 'FINALIZED',
        snapshot: createStartlistSnapshot('FINALIZED'),
        confirmedAt: TIMESTAMP,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      history: [],
    } as const;
    await services.cache.setStartlist(EVENT_ID, RACE_ID, {
      startlist: staleStartlist.startlist,
      history: staleStartlist.history,
    });

    const finalEvent = new StartlistFinalizedEvent(STARTLIST_ID, createStartlistSnapshot('FINALIZED'), new Date(TIMESTAMP));
    await subscriber.handle(finalEvent);

    expect(await services.cache.getStartlist(EVENT_ID, RACE_ID)).toBeUndefined();
    expect(services.cdnClient.purgePaths).toHaveBeenCalledWith([
      `/api/public/events/${EVENT_ID}`,
      `/api/public/events/${EVENT_ID}/races/${RACE_ID}/startlist`,
    ]);
  });
});
