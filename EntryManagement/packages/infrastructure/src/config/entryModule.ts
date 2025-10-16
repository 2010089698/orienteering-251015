import {
  EntryFactory,
  EntryRepository,
  SystemClock,
} from '@entry-management/domain';
import {
  ApplicationEventPublisher,
  EntryQueryService,
  EntryQueryServiceImpl,
  RegisterEntryService,
  RegisterEntryUseCase,
  TransactionManager,
} from '@entry-management/application';
import { DomainEventBus } from '../messaging/DomainEventBus.js';
import { InMemoryEntryRepository } from '../persistence/InMemoryEntryRepository.js';
import { SimpleTransactionManager } from '../transaction/SimpleTransactionManager.js';

export interface EntryUseCases {
  registerEntry: RegisterEntryUseCase;
}

export interface EntryModule {
  repository: EntryRepository;
  transactionManager: TransactionManager;
  eventPublisher: ApplicationEventPublisher;
  useCases: EntryUseCases;
  queryService: EntryQueryService;
}

export const createEntryModule = (): EntryModule => {
  const repository = new InMemoryEntryRepository();
  const transactionManager = new SimpleTransactionManager();
  const eventPublisher = new DomainEventBus();
  const factory = new EntryFactory(SystemClock);

  const registerEntry = new RegisterEntryService(
    repository,
    factory,
    transactionManager,
    eventPublisher,
  );

  const queryService = new EntryQueryServiceImpl(repository);

  return {
    repository,
    transactionManager,
    eventPublisher,
    useCases: {
      registerEntry,
    },
    queryService,
  };
};
