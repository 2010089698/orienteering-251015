import { RaceId, StartlistReference } from '@event-management/domain';

import { validateWithSchema } from '../../shared/validation.js';
import { mapEventToDto } from '../dto/EventMappers.js';
import { type EventDto, type AttachStartlistCommand } from '../dto/EventDtos.js';
import { AttachStartlistCommandSchema } from '../dto/EventSchemas.js';
import { EventServiceBase, type EventServiceDependencies } from './EventServiceBase.js';
import { RaceNotFoundError, ValidationError } from '../../shared/errors.js';

function parseDateTime(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new ValidationError(`${label} must be a valid ISO 8601 date string.`);
  }
  return date;
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('Startlist public URL must not be empty.');
  }
  try {
    const url = new URL(trimmed);
    return url.toString();
  } catch {
    throw new ValidationError('Startlist public URL must be a valid absolute URL.');
  }
}

function resolveStatus(command: AttachStartlistCommand, existingStatus?: string): string {
  const candidate = command.status?.trim() ?? existingStatus?.trim();
  return candidate && candidate.length > 0 ? candidate : 'FINALIZED';
}

export class AttachStartlistService extends EventServiceBase {
  constructor(dependencies: EventServiceDependencies) {
    super(dependencies.repository, dependencies.transactionManager, dependencies.eventPublisher);
  }

  async execute(payload: unknown): Promise<EventDto> {
    const command = validateWithSchema(AttachStartlistCommandSchema, payload);

    const event = await this.withEvent(command.eventId, async (eventAggregate) => {
      const raceId = RaceId.from(command.raceId);
      const race = eventAggregate.getRace(raceId);
      if (!race) {
        throw new RaceNotFoundError(command.eventId, command.raceId);
      }

      const confirmedAt = parseDateTime(command.confirmedAt, 'Startlist confirmation time');
      const publicUrl =
        command.publicUrl !== undefined ? normalizeUrl(command.publicUrl) : undefined;
      const status = resolveStatus(command, race.getStartlistStatus());

      const reference = StartlistReference.create({
        startlistId: command.startlistId,
        status,
        confirmedAt,
        publicVersion: command.version,
        publicUrl,
      });

      eventAggregate.attachStartlistReference(raceId, reference);
    });

    return mapEventToDto(event);
  }
}
