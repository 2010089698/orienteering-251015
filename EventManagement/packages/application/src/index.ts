import { type EventDefinition, validateEventDefinition } from '@event-management/domain';

export interface EventRepository {
  save(event: EventDefinition): Promise<void>;
  findById(id: string): Promise<EventDefinition | undefined>;
  findAll(): Promise<readonly EventDefinition[]>;
}

export class RegisterEventUseCase {
  constructor(private readonly repository: EventRepository) {}

  async execute(input: EventDefinition): Promise<EventDefinition> {
    const validated = validateEventDefinition(input);
    await this.repository.save(validated);
    return validated;
  }
}

export class GetEventQuery {
  constructor(private readonly repository: EventRepository) {}

  async execute(id: string): Promise<EventDefinition | undefined> {
    return this.repository.findById(id);
  }
}

export class ListEventsQuery {
  constructor(private readonly repository: EventRepository) {}

  async execute(): Promise<readonly EventDefinition[]> {
    return this.repository.findAll();
  }
}

export interface EventModule {
  registerEventUseCase: RegisterEventUseCase;
  getEventQuery: GetEventQuery;
  listEventsQuery: ListEventsQuery;
}
