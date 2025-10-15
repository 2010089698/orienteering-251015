import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository.js';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot.js';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { InvalidateStartTimesCommand } from '../dto/StartlistDtos.js';
import { StartlistCommandBase } from './StartlistCommandBase.js';

export interface InvalidateStartTimesUseCase {
  execute(command: InvalidateStartTimesCommand): Promise<StartlistSnapshot>;
}

export class InvalidateStartTimesService
  extends StartlistCommandBase
  implements InvalidateStartTimesUseCase
{
  constructor(
    repository: StartlistRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, transactionManager, eventPublisher);
  }

  async execute(command: InvalidateStartTimesCommand): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(command.startlistId, (startlist) => {
      startlist.invalidateStartTimes(command.reason);
    });
  }
}
