import type { EventDefinition } from '@event-management/domain';
import {
  type EventRepository,
  RegisterEventUseCase,
  GetEventQuery,
  ListEventsQuery,
  type EventModule
} from '@event-management/application';

class InMemoryEventRepository implements EventRepository {
  private readonly events = new Map<string, EventDefinition>();

  async save(event: EventDefinition): Promise<void> {
    this.events.set(event.id, event);
  }

  async findById(id: string): Promise<EventDefinition | undefined> {
    return this.events.get(id);
  }

  async findAll(): Promise<readonly EventDefinition[]> {
    return Array.from(this.events.values()).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }
}

export interface CreateEventModuleOptions {
  repository?: EventRepository;
}

export function createEventModule(options: CreateEventModuleOptions = {}): EventModule & {
  repository: EventRepository;
} {
  const repository = options.repository ?? new InMemoryEventRepository();
  return {
    repository,
    registerEventUseCase: new RegisterEventUseCase(repository),
    getEventQuery: new GetEventQuery(repository),
    listEventsQuery: new ListEventsQuery(repository)
  };
}

export { InMemoryEventRepository };
