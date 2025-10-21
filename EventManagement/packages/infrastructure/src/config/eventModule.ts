import {
  AttachStartlistService,
  CreateEventService,
  EventQueryService,
  type EventRepository,
  type EventServiceDependencies,
  ScheduleRaceService,
  type ScheduleRaceServiceDependencies,
  type TransactionManager,
  type EventQueryRepository,
  type StartlistSyncPort,
} from '@event-management/application';
import {
  Event,
  RaceSchedulingService,
  RaceScheduled,
} from '@event-management/domain';

import { DomainEventBus } from '../messaging/DomainEventBus.js';
import { InMemoryEventRepository } from '../persistence/InMemoryEventRepository.js';
import { InMemoryEventQueryRepository } from '../persistence/InMemoryEventQueryRepository.js';
import { SimpleTransactionManager } from '../transaction/SimpleTransactionManager.js';
import { HttpStartlistSyncPort, type HttpStartlistSyncPortOptions } from '../sync/HttpStartlistSyncPort.js';

export interface StartlistSyncOptions extends Partial<HttpStartlistSyncPortOptions> {
  port?: StartlistSyncPort;
}

export interface CreateEventModuleOptions {
  store?: Map<string, Event>;
  repository?: EventRepository;
  queryRepository?: EventQueryRepository;
  transactionManager?: TransactionManager;
  raceSchedulingService?: RaceSchedulingService;
  domainEventBus?: DomainEventBus;
  startlistSync?: StartlistSyncOptions;
}

export interface EventModule {
  repository: EventRepository;
  queryRepository: EventQueryRepository;
  transactionManager: TransactionManager;
  raceSchedulingService: RaceSchedulingService;
  domainEventBus: DomainEventBus;
  startlistSyncPort?: StartlistSyncPort;
  createEventService: CreateEventService;
  scheduleRaceService: ScheduleRaceService;
  attachStartlistService: AttachStartlistService;
  eventQueryService: EventQueryService;
}

export const createEventModule = (options: CreateEventModuleOptions = {}): EventModule => {
  const store = options.store ?? new Map<string, Event>();
  const repository = options.repository ?? new InMemoryEventRepository({ store });
  const queryRepository = options.queryRepository ?? new InMemoryEventQueryRepository(store);
  const transactionManager = options.transactionManager ?? new SimpleTransactionManager();
  const raceSchedulingService = options.raceSchedulingService ?? new RaceSchedulingService();
  const domainEventBus = options.domainEventBus ?? new DomainEventBus();

  const baseDependencies: EventServiceDependencies = {
    repository,
    transactionManager,
    eventPublisher: domainEventBus,
  };

  const scheduleRaceDependencies: ScheduleRaceServiceDependencies = {
    ...baseDependencies,
    raceSchedulingService,
  };

  const startlistSyncPort = resolveStartlistSyncPort(options.startlistSync);

  if (startlistSyncPort) {
    domainEventBus.subscribe(async (event) => {
      if (event instanceof RaceScheduled) {
        try {
          await startlistSyncPort.notifyRaceScheduled({
            eventId: event.eventId,
            raceId: event.raceId,
            schedule: event.schedule,
            updatedAt: event.occurredAt,
          });
        } catch (error) {
          console.error(
            `Failed to notify startlist sync port for event ${event.eventId.toString()} and race ${event.raceId.toString()}.`,
            error,
          );
        }
      }
    });
  }

  return {
    repository,
    queryRepository,
    transactionManager,
    raceSchedulingService,
    domainEventBus,
    startlistSyncPort,
    createEventService: new CreateEventService(baseDependencies),
    scheduleRaceService: new ScheduleRaceService(scheduleRaceDependencies),
    attachStartlistService: new AttachStartlistService(baseDependencies),
    eventQueryService: new EventQueryService(queryRepository),
  };
};

function resolveStartlistSyncPort(options?: StartlistSyncOptions): StartlistSyncPort | undefined {
  if (!options) {
    return undefined;
  }

  if (options.port) {
    return options.port;
  }

  if (!options.baseUrl) {
    return undefined;
  }

  return new HttpStartlistSyncPort({ baseUrl: options.baseUrl, fetchImpl: options.fetchImpl });
}
