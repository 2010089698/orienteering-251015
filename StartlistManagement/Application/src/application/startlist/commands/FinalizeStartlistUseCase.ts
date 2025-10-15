import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository.js';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot.js';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { FinalizeStartlistCommand } from '../dto/StartlistDtos.js';
import { StartlistCommandBase } from './StartlistCommandBase.js';

export interface FinalizeStartlistUseCase {
  execute(command: FinalizeStartlistCommand): Promise<StartlistSnapshot>;
}

export class FinalizeStartlistService extends StartlistCommandBase implements FinalizeStartlistUseCase {
  constructor(
    repository: StartlistRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, transactionManager, eventPublisher);
  }

  async execute(command: FinalizeStartlistCommand): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(command.startlistId, (startlist) => {
      startlist.finalizeStartlist();
    });
  }
}
