import {
  StartlistRepository,
  StartlistSnapshot,
  StartlistVersionRepository,
} from '@startlist-management/domain';
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
    versionRepository: StartlistVersionRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, versionRepository, transactionManager, eventPublisher);
  }

  async execute(command: InvalidateStartTimesCommand): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(command.startlistId, (startlist) => {
      startlist.invalidateStartTimes(command.reason);
    });
  }
}
