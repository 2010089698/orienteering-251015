import { describe, expect, it, vi } from 'vitest';
import { EventCreated, RaceScheduled } from '@event-management/domain';
import { EventId, RaceId, RaceSchedule } from '@event-management/domain';
import {
  StartlistFinalizedEvent,
  StartlistSettingsEnteredEvent,
  StartlistVersionGeneratedEvent,
  type StartlistSnapshot,
} from '@startlist-management/domain';

import { InMemoryPublicProjectionRepository } from '../InMemoryPublicProjectionRepository.js';
import { PublicProjectionSubscriber } from '../PublicProjectionSubscriber.js';

const EVENT_ID = 'event-123';
const RACE_ID = 'race-abc';
const STARTLIST_ID = 'startlist-xyz';
const TIMESTAMP = '2024-01-01T10:00:00.000Z';

const buildEventDto = (overrides: Partial<ReturnType<typeof createEventDto>> = {}) => ({
  ...createEventDto(),
  ...overrides,
});

function createEventDto() {
  return {
    id: EVENT_ID,
    name: 'Orienteering Cup',
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-01-02T23:59:59.000Z',
    venue: 'Forest Arena',
    allowMultipleRacesPerDay: true,
    allowScheduleOverlap: true,
    races: [
      {
        id: RACE_ID,
        name: 'Qualifier',
        schedule: { start: TIMESTAMP },
        duplicateDay: false,
        overlapsExisting: false,
      },
    ],
  };
}

function createRaceDto() {
  return createEventDto().races[0]!;
}

function createStartlistSnapshot(status: StartlistSnapshot['status'] = 'DRAFT'): StartlistSnapshot {
  return {
    id: STARTLIST_ID,
    eventId: EVENT_ID,
    raceId: RACE_ID,
    status,
    settings: {
      eventId: EVENT_ID,
      startTime: TIMESTAMP,
      laneCount: 4,
      intervals: {
        laneClass: { milliseconds: 60000 },
        classPlayer: { milliseconds: 30000 },
      },
    },
    laneAssignments: [],
    classAssignments: [],
    startTimes: [],
  };
}

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
                ...createRaceDto(),
                startlist: { id: STARTLIST_ID, status: 'DRAFT' },
              },
            ],
          }),
        )
        .mockResolvedValue(
          buildEventDto({
            races: [
              {
                ...createRaceDto(),
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
