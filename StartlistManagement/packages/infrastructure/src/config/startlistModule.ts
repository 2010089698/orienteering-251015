import {
  StartlistFactory,
  SystemClock,
  StartlistRepository,
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
  TransactionManager,
} from '@startlist-management/application';
import { DomainEventBus } from '../messaging/DomainEventBus.js';
import { InMemoryStartlistRepository } from '../persistence/InMemoryStartlistRepository.js';
import { SimpleTransactionManager } from '../transaction/SimpleTransactionManager.js';

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
  transactionManager: TransactionManager;
  eventPublisher: ApplicationEventPublisher;
  useCases: StartlistUseCases;
  queryService: StartlistQueryService;
}

export const createStartlistModule = (): StartlistModule => {
  const repository = new InMemoryStartlistRepository();
  const transactionManager = new SimpleTransactionManager();
  const eventPublisher = new DomainEventBus();
  const factory = new StartlistFactory(SystemClock);

  const enterStartlistSettings = new EnterStartlistSettingsService(
    repository,
    transactionManager,
    eventPublisher,
    factory,
  );
  const assignLaneOrder = new AssignLaneOrderService(repository, transactionManager, eventPublisher);
  const assignPlayerOrder = new AssignPlayerOrderService(
    repository,
    transactionManager,
    eventPublisher,
  );
  const assignStartTimes = new AssignStartTimesService(repository, transactionManager, eventPublisher);
  const finalizeStartlist = new FinalizeStartlistService(repository, transactionManager, eventPublisher);
  const manuallyReassignLaneOrder = new ManuallyReassignLaneOrderService(
    repository,
    transactionManager,
    eventPublisher,
  );
  const manuallyFinalizeClassStartOrder = new ManuallyFinalizeClassStartOrderService(
    repository,
    transactionManager,
    eventPublisher,
  );
  const invalidateStartTimes = new InvalidateStartTimesService(
    repository,
    transactionManager,
    eventPublisher,
  );

  const queryService = new StartlistQueryServiceImpl(repository);

  return {
    repository,
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
