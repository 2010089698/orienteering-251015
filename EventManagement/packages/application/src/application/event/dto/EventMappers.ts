import {
  type Event,
  type EventProps,
  type Race,
  EventDateRange,
  EventId,
  RaceId,
  RaceSchedule,
  StartlistLink,
} from '@event-management/domain';

import { ValidationError } from '../../shared/errors.js';
import {
  type AttachStartlistCommand,
  type CreateEventCommand,
  type ScheduleRaceCommand,
  type EventDto,
  type RaceDto,
} from './EventDtos.js';

interface StartlistAttachmentInput {
  link: StartlistLink;
  updatedAt?: Date;
  publicVersion?: number;
}

function parseDateTime(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new ValidationError(`${label} must be a valid ISO 8601 date-time string.`);
  }
  return date;
}

export function mapToEventProps(command: CreateEventCommand): EventProps {
  const start = parseDateTime(command.startDate, 'Event start date');
  const end = parseDateTime(command.endDate, 'Event end date');

  return {
    id: EventId.from(command.eventId),
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
  const start = parseDateTime(command.start, 'Race start');
  const end = command.end ? parseDateTime(command.end, 'Race end') : undefined;
  return {
    id: RaceId.from(command.raceId),
    name: command.name,
    schedule: RaceSchedule.from(start, end),
  };
}

export function mapToStartlistAttachment(command: AttachStartlistCommand): StartlistAttachmentInput {
  const link = StartlistLink.from(command.startlistLink);
  const updatedAt = command.startlistUpdatedAt
    ? parseDateTime(command.startlistUpdatedAt, 'Startlist updated at')
    : undefined;
  return {
    link,
    updatedAt,
    publicVersion: command.startlistPublicVersion,
  };
}

export function mapRaceToDto(race: Race): RaceDto {
  const schedule = race.getSchedule();
  const end = schedule.getEnd();
  const startlistLink = race.getStartlistLink();
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
    ...(startlistLink ? { startlistLink: startlistLink.toString() } : {}),
    ...(startlistUpdatedAt ? { startlistUpdatedAt: startlistUpdatedAt.toISOString() } : {}),
    ...(startlistPublicVersion ? { startlistPublicVersion } : {}),
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
