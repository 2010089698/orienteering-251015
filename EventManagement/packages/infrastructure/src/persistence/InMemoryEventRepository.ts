import { Event, EventId } from '@event-management/domain';
import { EventRepository } from '@event-management/application';

export interface InMemoryEventRepositoryOptions {
  store?: Map<string, Event>;
}

export class InMemoryEventRepository implements EventRepository {
  private readonly store: Map<string, Event>;

  constructor(options: InMemoryEventRepositoryOptions = {}) {
    this.store = options.store ?? new Map<string, Event>();
  }

  async findById(id: EventId): Promise<Event | undefined> {
    return this.store.get(id.toString());
  }

  async save(event: Event): Promise<void> {
    this.store.set(event.getId().toString(), event);
  }

  async findAll(): Promise<readonly Event[]> {
    return Array.from(this.store.values());
  }

  clear(): void {
    this.store.clear();
  }

  delete(id: EventId): void {
    this.store.delete(id.toString());
  }

  get events(): Map<string, Event> {
    return this.store;
  }
}
