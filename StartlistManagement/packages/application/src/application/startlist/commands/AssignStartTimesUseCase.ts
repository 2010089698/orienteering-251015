import { StartlistRepository, StartlistSnapshot } from '@startlist-management/domain';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { toStartTimes } from '../dto/StartlistMappers.js';
import { AssignStartTimesCommand } from '../dto/StartlistDtos.js';
import { StartlistCommandBase } from './StartlistCommandBase.js';

export interface AssignStartTimesUseCase {
  execute(command: AssignStartTimesCommand): Promise<StartlistSnapshot>;
}

export class AssignStartTimesService extends StartlistCommandBase implements AssignStartTimesUseCase {
  constructor(
    repository: StartlistRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, transactionManager, eventPublisher);
  }

  async execute(command: AssignStartTimesCommand): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(command.startlistId, (startlist) => {
      const startTimes = toStartTimes(command.startTimes);
      startlist.assignStartTimes(startTimes);
    });
  }
}
