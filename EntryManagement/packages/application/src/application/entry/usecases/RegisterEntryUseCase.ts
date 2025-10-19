import {
  ApplicationEventPublisher,
  EntryCommandBase,
  TransactionManager,
} from '../../shared/index.js';
import { EntryFactory, EntryRepository } from '@entry-management/domain';
import { EntryDto } from '../dto/EntryDtos.js';
import { toEntryDto } from '../dto/EntryMappers.js';

export interface RegisterEntryCommand {
  name: string;
  classId: string;
  cardNumber: string;
  club?: string;
  iofId?: string;
}

export interface RegisterEntryUseCase {
  execute(command: RegisterEntryCommand): Promise<EntryDto>;
}

export class RegisterEntryService extends EntryCommandBase implements RegisterEntryUseCase {
  constructor(
    repository: EntryRepository,
    private readonly factory: EntryFactory,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, transactionManager, eventPublisher);
  }

  async execute(command: RegisterEntryCommand): Promise<EntryDto> {
    return super.execute(() => {
      const entry = this.factory.register(command);
      return {
        entry,
        result: toEntryDto(entry),
      };
    });
  }
}
