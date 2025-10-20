import {
  AttachStartlistService,
  CreateEventService,
  EventQueryService,
  type EventRepository,
  type EventServiceDependencies,
  ScheduleRaceService,
  type ScheduleRaceServiceDependencies,
  type ApplicationEventPublisher,
  type TransactionManager,
} from '@event-management/application';
import { Event, EventId, RaceSchedulingService } from '@event-management/domain';

class InMemoryEventRepository implements EventRepository {
  private readonly events = new Map<string, Event>();

  async findById(id: EventId): Promise<Event | undefined> {
    return this.events.get(id.toString());
  }

  async save(event: Event): Promise<void> {
    this.events.set(event.getId().toString(), event);
  }

  async findAll(): Promise<readonly Event[]> {
    return Array.from(this.events.values());
  }
}

class ImmediateTransactionManager implements TransactionManager {
  async execute<T>(work: () => Promise<T> | T): Promise<T> {
    return await work();
  }
}

class NoopEventPublisher implements ApplicationEventPublisher {
  async publish(): Promise<void> {
    // Intentionally left blank for in-memory usage.
  }
}

export interface CreateEventModuleOptions {
  repository?: EventRepository;
  transactionManager?: TransactionManager;
  eventPublisher?: ApplicationEventPublisher;
  raceSchedulingService?: RaceSchedulingService;
}

export function createEventModule(options: CreateEventModuleOptions = {}): {
  repository: EventRepository;
  transactionManager: TransactionManager;
  eventPublisher: ApplicationEventPublisher;
  raceSchedulingService: RaceSchedulingService;
  createEventService: CreateEventService;
  scheduleRaceService: ScheduleRaceService;
  attachStartlistService: AttachStartlistService;
  eventQueryService: EventQueryService;
} {
  const repository = options.repository ?? new InMemoryEventRepository();
  const transactionManager = options.transactionManager ?? new ImmediateTransactionManager();
  const eventPublisher = options.eventPublisher ?? new NoopEventPublisher();
  const raceSchedulingService = options.raceSchedulingService ?? new RaceSchedulingService();

  const baseDependencies: EventServiceDependencies = {
    repository,
    transactionManager,
    eventPublisher,
  };

  const scheduleRaceDependencies: ScheduleRaceServiceDependencies = {
    ...baseDependencies,
    raceSchedulingService,
  };

  return {
    repository,
    transactionManager,
    eventPublisher,
    raceSchedulingService,
    createEventService: new CreateEventService(baseDependencies),
    scheduleRaceService: new ScheduleRaceService(scheduleRaceDependencies),
    attachStartlistService: new AttachStartlistService(baseDependencies),
    eventQueryService: new EventQueryService(repository),
  };
}

export { InMemoryEventRepository, ImmediateTransactionManager, NoopEventPublisher };
