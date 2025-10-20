import { Event, EventId } from '@event-management/domain';
import { EventQueryRepository } from '@event-management/application';

export class InMemoryEventQueryRepository implements EventQueryRepository {
  constructor(private readonly store: Map<string, Event>) {}

  async findById(id: EventId): Promise<Event | undefined> {
    return this.store.get(id.toString());
  }

  async findAll(): Promise<readonly Event[]> {
    return Array.from(this.store.values());
  }
}
