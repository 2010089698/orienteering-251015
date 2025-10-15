import { StartlistFactory } from '../../../Domain/src/startlist/StartlistFactory.js';
import { SystemClock } from '../../../Domain/src/common/DomainClock.js';
import { StartlistRepository } from '../../../Domain/src/startlist/StartlistRepository.js';
import { StartlistProcessManager } from '../../../Application/src/application/startlist/process-manager/StartlistProcessManager.js';
import {
  AssignLaneOrderService,
  AssignLaneOrderUseCase,
} from '../../../Application/src/application/startlist/commands/AssignLaneOrderUseCase.js';
import {
  AssignPlayerOrderService,
  AssignPlayerOrderUseCase,
} from '../../../Application/src/application/startlist/commands/AssignPlayerOrderUseCase.js';
import {
  AssignStartTimesService,
  AssignStartTimesUseCase,
} from '../../../Application/src/application/startlist/commands/AssignStartTimesUseCase.js';
import {
  EnterStartlistSettingsService,
  EnterStartlistSettingsUseCase,
} from '../../../Application/src/application/startlist/commands/EnterStartlistSettingsUseCase.js';
import {
  FinalizeStartlistService,
  FinalizeStartlistUseCase,
} from '../../../Application/src/application/startlist/commands/FinalizeStartlistUseCase.js';
import {
  InvalidateStartTimesService,
  InvalidateStartTimesUseCase,
} from '../../../Application/src/application/startlist/commands/InvalidateStartTimesUseCase.js';
import {
  ManuallyFinalizeClassStartOrderService,
  ManuallyFinalizeClassStartOrderUseCase,
} from '../../../Application/src/application/startlist/commands/ManuallyFinalizeClassStartOrderUseCase.js';
import {
  ManuallyReassignLaneOrderService,
  ManuallyReassignLaneOrderUseCase,
} from '../../../Application/src/application/startlist/commands/ManuallyReassignLaneOrderUseCase.js';
import { StartlistQueryService, StartlistQueryServiceImpl } from '../../../Application/src/application/startlist/queries/StartlistQueryService.js';
import { ApplicationEventPublisher } from '../../../Application/src/application/shared/event-publisher.js';
import { TransactionManager } from '../../../Application/src/application/shared/transaction.js';
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
  processManager: StartlistProcessManager;
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

  const processManager = new StartlistProcessManager(invalidateStartTimes);
  eventPublisher.subscribe((event) => processManager.handle(event));

  const queryService = new StartlistQueryServiceImpl(repository);

  return {
    repository,
    transactionManager,
    eventPublisher,
    processManager,
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
