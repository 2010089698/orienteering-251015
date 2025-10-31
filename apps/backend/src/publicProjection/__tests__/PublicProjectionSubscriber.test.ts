import { describe, expect, it, vi } from 'vitest';
import { EventCreated, EventId, RaceId, RaceSchedule, RaceScheduled } from '@event-management/domain';
import {
  StartlistFinalizedEvent,
  StartlistSettingsEnteredEvent,
  StartlistVersionGeneratedEvent,
} from '@startlist-management/domain';

import { InMemoryPublicProjectionRepository } from '../InMemoryPublicProjectionRepository.js';
import { PublicProjectionSubscriber } from '../PublicProjectionSubscriber.js';
import {
  EVENT_ID,
  RACE_ID,
  STARTLIST_ID,
  TIMESTAMP,
  buildEventDto,
  buildRaceDto,
  createEventDto,
  createStartlistSnapshot,
} from './fixtures.js';

describe('PublicProjectionSubscriber', () => {
  it('projects events, races, and startlists from domain events', async () => {
    const repository = new InMemoryPublicProjectionRepository();
    const eventQueryService = {
      getById: vi
        .fn()
        .mockResolvedValueOnce(createEventDto())
        .mockResolvedValueOnce(
          buildEventDto({
            races: [
              {
                ...buildRaceDto(),
                startlist: { id: STARTLIST_ID, status: 'DRAFT' },
              },
            ],
          }),
        )
        .mockResolvedValue(
          buildEventDto({
            races: [
              {
                ...buildRaceDto(),
                startlist: { id: STARTLIST_ID, status: 'FINALIZED' },
              },
            ],
          }),
        ),
    };
    const startlistSnapshots = [
      createStartlistSnapshot('SETTINGS_ENTERED'),
      createStartlistSnapshot('FINALIZED'),
    ];
    const startlistQueryService = {
      execute: vi.fn().mockImplementation(async () => startlistSnapshots.shift() ?? createStartlistSnapshot()),
    };

    const subscriber = new PublicProjectionSubscriber({
      repository,
      eventQueryService: eventQueryService as never,
      startlistQueryService: startlistQueryService as never,
    });

    const eventCreated = new EventCreated(EventId.from(EVENT_ID));
    await subscriber.handle(eventCreated);

    const raceScheduled = new RaceScheduled(
      EventId.from(EVENT_ID),
      RaceId.from(RACE_ID),
      RaceSchedule.from(new Date(TIMESTAMP)),
    );
    await subscriber.handle(raceScheduled);

    const settingsEvent = new StartlistSettingsEnteredEvent(
      STARTLIST_ID,
      {
        eventId: EVENT_ID,
        startTime: TIMESTAMP,
        laneCount: 4,
        intervals: {
          laneClass: { milliseconds: 60000 },
          classPlayer: { milliseconds: 30000 },
        },
      },
      new Date(TIMESTAMP),
    );
    await subscriber.handle(settingsEvent);

    const finalSnapshot = createStartlistSnapshot('FINALIZED');
    const finalized = new StartlistFinalizedEvent(STARTLIST_ID, finalSnapshot, new Date(TIMESTAMP));
    await subscriber.handle(finalized);

    const versioned = new StartlistVersionGeneratedEvent(STARTLIST_ID, finalSnapshot, new Date(TIMESTAMP));
    await subscriber.handle(versioned);

    const events = await repository.listEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe(EVENT_ID);
    expect(events[0]?.races).toHaveLength(1);
    const race = events[0]?.races[0];
    expect(race?.startlistId).toBe(STARTLIST_ID);
    expect(race?.startlist?.status).toBe('FINALIZED');

    const startlistDetails = await repository.findStartlistByRace(EVENT_ID, RACE_ID);
    expect(startlistDetails?.startlist.id).toBe(STARTLIST_ID);
    expect(startlistDetails?.history).toHaveLength(1);
    expect(startlistDetails?.history[0]?.version).toBe(1);
  });
});
