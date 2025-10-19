import {
  EntryFactory,
  EntryRepository,
  SystemClock,
} from '@entry-management/domain';
import {
  ApplicationEventPublisher,
  EntryQueryService,
  EntryQueryServiceImpl,
  EntryReadRepository,
  RegisterEntryService,
  RegisterEntryUseCase,
  TransactionManager,
} from '@entry-management/application';
import { DomainEventBus } from '../messaging/DomainEventBus.js';
import {
  InMemoryEntryReadRepository,
  InMemoryEntryRepository,
  createInMemoryEntryRepositoryStore,
} from '../persistence/InMemoryEntryRepository.js';
import { SimpleTransactionManager } from '../transaction/SimpleTransactionManager.js';

export interface EntryUseCases {
  registerEntry: RegisterEntryUseCase;
}

export interface EntryModule {
  repository: EntryRepository;
  readRepository: EntryReadRepository;
  transactionManager: TransactionManager;
  eventPublisher: ApplicationEventPublisher;
  useCases: EntryUseCases;
  queryService: EntryQueryService;
}

export const createEntryModule = (): EntryModule => {
  const store = createInMemoryEntryRepositoryStore();
  const repository = new InMemoryEntryRepository(store);
  const readRepository = new InMemoryEntryReadRepository(store);
  const transactionManager = new SimpleTransactionManager();
  const eventPublisher = new DomainEventBus();
  const factory = new EntryFactory(SystemClock);

  const registerEntry = new RegisterEntryService(
    repository,
    factory,
    transactionManager,
    eventPublisher,
  );

  const queryService = new EntryQueryServiceImpl(readRepository);

  return {
    repository,
    readRepository,
    transactionManager,
    eventPublisher,
    useCases: {
      registerEntry,
    },
    queryService,
  };
};
