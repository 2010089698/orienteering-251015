import {
  StartlistFactory,
  StartlistSnapshot,
  SystemClock,
  StartlistRepository,
  StartlistVersionRepository,
} from '@startlist-management/domain';
import {
  ApplicationEventPublisher,
  AssignLaneOrderService,
  AssignLaneOrderUseCase,
  AssignPlayerOrderService,
  AssignPlayerOrderUseCase,
  AssignStartTimesService,
  AssignStartTimesUseCase,
  EnterStartlistSettingsService,
  EnterStartlistSettingsUseCase,
  FinalizeStartlistService,
  FinalizeStartlistUseCase,
  InvalidateStartTimesService,
  InvalidateStartTimesUseCase,
  ManuallyFinalizeClassStartOrderService,
  ManuallyFinalizeClassStartOrderUseCase,
  ManuallyReassignLaneOrderService,
  ManuallyReassignLaneOrderUseCase,
  StartlistQueryService,
  StartlistQueryServiceImpl,
  StartlistReadRepository,
  TransactionManager,
} from '@startlist-management/application';
import { DomainEventBus } from '../messaging/DomainEventBus.js';
import { InMemoryStartlistReadRepository } from '../persistence/InMemoryStartlistReadRepository.js';
import { InMemoryStartlistRepository } from '../persistence/InMemoryStartlistRepository.js';
import { SimpleTransactionManager } from '../transaction/SimpleTransactionManager.js';
import { InMemoryStartlistVersionRepository } from '../persistence/InMemoryStartlistVersionRepository.js';

export interface StartlistUseCases {
  enterStartlistSettings: EnterStartlistSettingsUseCase;
  assignLaneOrder: AssignLaneOrderUseCase;
  assignPlayerOrder: AssignPlayerOrderUseCase;
  assignStartTimes: AssignStartTimesUseCase;
  finalizeStartlist: FinalizeStartlistUseCase;
  manuallyReassignLaneOrder: ManuallyReassignLaneOrderUseCase;
  manuallyFinalizeClassStartOrder: ManuallyFinalizeClassStartOrderUseCase;
  invalidateStartTimes: InvalidateStartTimesUseCase;
}

export interface StartlistModule {
  repository: StartlistRepository;
  versionRepository: StartlistVersionRepository;
  readRepository: StartlistReadRepository;
  transactionManager: TransactionManager;
  eventPublisher: ApplicationEventPublisher;
  useCases: StartlistUseCases;
  queryService: StartlistQueryService;
}

export const createStartlistModule = (): StartlistModule => {
  const store = new Map<string, StartlistSnapshot>();
  const repository = new InMemoryStartlistRepository({ store });
  const versionRepository = new InMemoryStartlistVersionRepository();
  const readRepository = new InMemoryStartlistReadRepository(store);
  const transactionManager = new SimpleTransactionManager();
  const eventPublisher = new DomainEventBus();
  const factory = new StartlistFactory(SystemClock);

  const enterStartlistSettings = new EnterStartlistSettingsService(
    repository,
    versionRepository,
    transactionManager,
    eventPublisher,
    factory,
  );
  const assignLaneOrder = new AssignLaneOrderService(
    repository,
    versionRepository,
    transactionManager,
    eventPublisher,
  );
  const assignPlayerOrder = new AssignPlayerOrderService(
    repository,
    versionRepository,
    transactionManager,
    eventPublisher,
  );
  const assignStartTimes = new AssignStartTimesService(
    repository,
    versionRepository,
    transactionManager,
    eventPublisher,
  );
  const finalizeStartlist = new FinalizeStartlistService(
    repository,
    versionRepository,
    transactionManager,
    eventPublisher,
  );
  const manuallyReassignLaneOrder = new ManuallyReassignLaneOrderService(
    repository,
    versionRepository,
    transactionManager,
    eventPublisher,
  );
  const manuallyFinalizeClassStartOrder = new ManuallyFinalizeClassStartOrderService(
    repository,
    versionRepository,
    transactionManager,
    eventPublisher,
  );
  const invalidateStartTimes = new InvalidateStartTimesService(
    repository,
    versionRepository,
    transactionManager,
    eventPublisher,
  );

  const queryService = new StartlistQueryServiceImpl(readRepository);

  return {
    repository,
    versionRepository,
    readRepository,
    transactionManager,
    eventPublisher,
    useCases: {
      enterStartlistSettings,
      assignLaneOrder,
      assignPlayerOrder,
      assignStartTimes,
      finalizeStartlist,
      manuallyReassignLaneOrder,
      manuallyFinalizeClassStartOrder,
      invalidateStartTimes,
    },
    queryService,
  };
};
