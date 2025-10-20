import { Event } from '@event-management/domain';

import { validateWithSchema } from '../../shared/validation.js';
import { mapEventToDto, mapToEventProps } from '../dto/EventMappers.js';
import { type EventDto } from '../dto/EventDtos.js';
import { CreateEventCommandSchema } from '../dto/EventSchemas.js';
import { EventServiceBase, type EventServiceDependencies } from './EventServiceBase.js';

export class CreateEventService extends EventServiceBase {
  constructor(dependencies: EventServiceDependencies) {
    super(dependencies.repository, dependencies.transactionManager, dependencies.eventPublisher);
  }

  async execute(payload: unknown): Promise<EventDto> {
    const command = validateWithSchema(CreateEventCommandSchema, payload);
    const event = await this.createEvent(() => Event.create(mapToEventProps(command)));
    return mapEventToDto(event);
  }
}
