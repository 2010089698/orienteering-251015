import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot';
import { ApplicationEventPublisher } from '../../shared/event-publisher';
import { TransactionManager } from '../../shared/transaction';
import { InvalidateStartTimesCommand } from '../dto/StartlistDtos';
import { StartlistCommandBase } from './StartlistCommandBase';

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
