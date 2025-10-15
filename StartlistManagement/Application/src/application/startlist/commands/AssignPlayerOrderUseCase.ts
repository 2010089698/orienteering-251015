import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot';
import { ApplicationEventPublisher } from '../../shared/event-publisher';
import { TransactionManager } from '../../shared/transaction';
import { toClassAssignments } from '../dto/StartlistMappers';
import { AssignPlayerOrderCommand } from '../dto/StartlistDtos';
import { StartlistCommandBase } from './StartlistCommandBase';

export interface AssignPlayerOrderUseCase {
  execute(command: AssignPlayerOrderCommand): Promise<StartlistSnapshot>;
}

export class AssignPlayerOrderService
  extends StartlistCommandBase
  implements AssignPlayerOrderUseCase
{
  constructor(
    repository: StartlistRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, transactionManager, eventPublisher);
  }

  async execute(command: AssignPlayerOrderCommand): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(command.startlistId, (startlist) => {
      const assignments = toClassAssignments(command.assignments);
      startlist.assignPlayerOrderAndIntervals(assignments);
    });
  }
}
