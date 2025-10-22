import {
  type Event,
  type EventProps,
  type Race,
  EventDateRange,
  EventId,
  RaceId,
  RaceSchedule,
  StartlistAttachment,
} from '@event-management/domain';

import { ValidationError } from '../../shared/errors.js';
import {
  type AttachStartlistCommand,
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

export function mapToStartlistAttachment(command: AttachStartlistCommand): StartlistAttachment {
  const updatedAt = command.startlistUpdatedAt
    ? parseDateTime(command.startlistUpdatedAt, 'Startlist updated at')
    : undefined;
  return StartlistAttachment.create({
    startlistId: command.startlistId,
    publicUrl: command.startlistLink,
    updatedAt,
    publicVersion: command.startlistPublicVersion,
  });
}

export function mapRaceToDto(race: Race): RaceDto {
  const schedule = race.getSchedule();
  const end = schedule.getEnd();
  const startlistId = race.getStartlistId();
  const startlistLink = race.getStartlistPublicUrl();
  const startlistUpdatedAt = race.getStartlistUpdatedAt();
  const startlistPublicVersion = race.getStartlistPublicVersion();
  return {
    id: race.getId().toString(),
    name: race.getName(),
    schedule: {
      start: schedule.getStart().toISOString(),
      ...(end ? { end: end.toISOString() } : {}),
    },
    duplicateDay: race.hasDuplicateDay(),
    overlapsExisting: race.hasScheduleOverlap(),
    ...(startlistId ? { startlistId } : {}),
    ...(startlistLink ? { startlistLink } : {}),
    ...(startlistUpdatedAt ? { startlistUpdatedAt: startlistUpdatedAt.toISOString() } : {}),
    ...(startlistPublicVersion !== undefined ? { startlistPublicVersion } : {}),
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
