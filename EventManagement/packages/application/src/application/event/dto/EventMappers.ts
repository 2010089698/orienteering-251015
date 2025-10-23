import {
  type Event,
  type EventProps,
  type Race,
  EventDateRange,
  EventId,
  RaceId,
  RaceSchedule,
} from '@event-management/domain';

import { ValidationError } from '../../shared/errors.js';
import {
  type CreateEventCommand,
  type ScheduleRaceCommand,
  type EventDto,
  type RaceDto,
} from './EventDtos.js';

function parseDateTime(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new ValidationError(`${label} must be a valid ISO 8601 date string.`);
  }
  return date;
}

export function mapToEventProps(command: CreateEventCommand): EventProps {
  const start = parseDateTime(command.startDate, 'Event start date');
  const end = parseDateTime(command.endDate, 'Event end date');

  return {
    id: EventId.generate(),
    name: command.name,
    dateRange: EventDateRange.from(start, end),
    venue: command.venue,
  };
}

export function mapToScheduleRaceInput(command: ScheduleRaceCommand): {
  id: RaceId;
  name: string;
  schedule: RaceSchedule;
} {
  const date = parseDateTime(command.date, 'Race date');
  return {
    id: RaceId.generate(),
    name: command.name,
    schedule: RaceSchedule.from(date),
  };
}

export function mapRaceToDto(race: Race): RaceDto {
  const schedule = race.getSchedule();
  const end = schedule.getEnd();
  const startlistReference = race.getStartlistReference();
  return {
    id: race.getId().toString(),
    name: race.getName(),
    schedule: {
      start: schedule.getStart().toISOString(),
      ...(end ? { end: end.toISOString() } : {}),
    },
    duplicateDay: race.hasDuplicateDay(),
    overlapsExisting: race.hasScheduleOverlap(),
    ...(startlistReference
      ? {
          startlist: {
            id: startlistReference.getId(),
            status: startlistReference.getStatus(),
            ...(startlistReference.getConfirmedAt()
              ? { confirmedAt: startlistReference.getConfirmedAt()?.toISOString() }
              : {}),
            ...(startlistReference.getPublicVersion()
              ? { publicVersion: startlistReference.getPublicVersion() }
              : {}),
            ...(startlistReference.getPublicUrl()
              ? { publicUrl: startlistReference.getPublicUrl() }
              : {}),
          },
        }
      : {}),
  };
}

export function mapEventToDto(event: Event): EventDto {
  const dateRange = event.getDateRange();
  return {
    id: event.getId().toString(),
    name: event.getName(),
    startDate: dateRange.getStart().toISOString(),
    endDate: dateRange.getEnd().toISOString(),
    venue: event.getVenue(),
    allowMultipleRacesPerDay: event.allowsMultipleRacesPerDay(),
    allowScheduleOverlap: event.allowsScheduleOverlap(),
    races: event.getRaces().map(mapRaceToDto),
  };
}
