import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot';
import { ApplicationEventPublisher } from '../../shared/event-publisher';
import { TransactionManager } from '../../shared/transaction';
import { FinalizeStartlistCommand } from '../dto/StartlistDtos';
import { StartlistCommandBase } from './StartlistCommandBase';

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
