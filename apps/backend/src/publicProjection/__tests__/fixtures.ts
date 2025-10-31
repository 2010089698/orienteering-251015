import type { EventDto, RaceDto } from '@event-management/application';
import type { StartlistSnapshot } from '@startlist-management/domain';

export const EVENT_ID = 'event-123';
export const RACE_ID = 'race-abc';
export const STARTLIST_ID = 'startlist-xyz';
export const TIMESTAMP = '2024-01-01T10:00:00.000Z';

export function createEventDto(): EventDto {
  return {
    id: EVENT_ID,
    name: 'Orienteering Cup',
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-01-02T23:59:59.000Z',
    venue: 'Forest Arena',
    allowMultipleRacesPerDay: true,
    allowScheduleOverlap: true,
    races: [createRaceDto()],
  };
}

export function createRaceDto(): RaceDto {
  return {
    id: RACE_ID,
    name: 'Qualifier',
    schedule: { start: TIMESTAMP },
    duplicateDay: false,
    overlapsExisting: false,
  };
}

export function buildEventDto(overrides: Partial<EventDto> = {}): EventDto {
  return {
    ...createEventDto(),
    ...overrides,
  };
}

export function buildRaceDto(overrides: Partial<RaceDto> = {}): RaceDto {
  return {
    ...createRaceDto(),
    ...overrides,
  };
}

export function createStartlistSnapshot(status: StartlistSnapshot['status'] = 'DRAFT'): StartlistSnapshot {
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
