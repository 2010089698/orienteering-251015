import { EventId } from '@event-management/domain';

import { mapEventToDto } from '../dto/EventMappers.js';
import { type EventDto } from '../dto/EventDtos.js';
import { type EventRepository } from './EventServiceBase.js';

export class EventQueryService {
  constructor(private readonly repository: EventRepository) {}

  async getById(eventId: string): Promise<EventDto | undefined> {
    const id = EventId.from(eventId);
    const event = await this.repository.findById(id);
    return event ? mapEventToDto(event) : undefined;
  }

  async listAll(): Promise<EventDto[]> {
    if (!this.repository.findAll) {
      throw new Error('EventRepository#findAll is not implemented.');
    }
    const events = await this.repository.findAll();
    return events.map(mapEventToDto);
  }
}
