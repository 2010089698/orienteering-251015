import { RaceId } from '@event-management/domain';

import { RaceNotFoundError } from '../../shared/errors.js';
import { validateWithSchema } from '../../shared/validation.js';
import { mapEventToDto, mapToStartlistAttachment } from '../dto/EventMappers.js';
import { type EventDto } from '../dto/EventDtos.js';
import { AttachStartlistCommandSchema } from '../dto/EventSchemas.js';
import { EventServiceBase, type EventServiceDependencies } from './EventServiceBase.js';

export class AttachStartlistService extends EventServiceBase {
  constructor(dependencies: EventServiceDependencies) {
    super(dependencies.repository, dependencies.transactionManager, dependencies.eventPublisher);
  }

  async execute(payload: unknown): Promise<EventDto> {
    const command = validateWithSchema(AttachStartlistCommandSchema, payload);
    const startlistAttachment = mapToStartlistAttachment(command);
    const event = await this.withEvent(command.eventId, (eventAggregate) => {
      const raceId = RaceId.from(command.raceId);
      const race = eventAggregate.getRace(raceId);
      if (!race) {
        throw new RaceNotFoundError(command.eventId, command.raceId);
      }
      eventAggregate.linkStartlist(raceId, startlistAttachment);
    });
    return mapEventToDto(event);
  }
}
