import { Event, EventId } from '@event-management/domain';

import { mapEventToDto } from '../dto/EventMappers.js';
import { type EventDto } from '../dto/EventDtos.js';

export interface EventQueryRepository {
  findById(id: EventId): Promise<Event | undefined>;
  findAll(): Promise<readonly Event[]>;
}

export class EventQueryService {
  constructor(private readonly repository: EventQueryRepository) {}

  async getById(eventId: string): Promise<EventDto | undefined> {
    const id = EventId.from(eventId);
    const event = await this.repository.findById(id);
    return event ? mapEventToDto(event) : undefined;
  }

  async listAll(): Promise<EventDto[]> {
    const events = await this.repository.findAll();
    return events.map(mapEventToDto);
  }
}
