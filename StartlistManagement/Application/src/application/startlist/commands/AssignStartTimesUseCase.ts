import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot';
import { ApplicationEventPublisher } from '../../shared/event-publisher';
import { TransactionManager } from '../../shared/transaction';
import { toStartTimes } from '../dto/StartlistMappers';
import { AssignStartTimesCommand } from '../dto/StartlistDtos';
import { StartlistCommandBase } from './StartlistCommandBase';

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
