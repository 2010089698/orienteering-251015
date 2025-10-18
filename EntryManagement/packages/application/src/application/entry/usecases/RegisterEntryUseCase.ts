import {
  ApplicationEventPublisher,
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

export class RegisterEntryService implements RegisterEntryUseCase {
  constructor(
    private readonly repository: EntryRepository,
    private readonly factory: EntryFactory,
    private readonly transactionManager: TransactionManager,
    private readonly eventPublisher: ApplicationEventPublisher,
  ) {}

  async execute(command: RegisterEntryCommand): Promise<EntryDto> {
    const entry = this.factory.register(command);

    return this.transactionManager.execute(async () => {
      await this.repository.save(entry);
      await this.eventPublisher.publish(entry.pullDomainEvents());
      return toEntryDto(entry);
    });
  }
}
