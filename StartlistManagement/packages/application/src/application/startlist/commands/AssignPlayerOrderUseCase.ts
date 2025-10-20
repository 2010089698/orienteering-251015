import {
  StartlistRepository,
  StartlistSnapshot,
  StartlistVersionRepository,
} from '@startlist-management/domain';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { toClassAssignments } from '../dto/StartlistMappers.js';
import { AssignPlayerOrderCommand } from '../dto/StartlistDtos.js';
import { StartlistCommandBase } from './StartlistCommandBase.js';

export interface AssignPlayerOrderUseCase {
  execute(command: AssignPlayerOrderCommand): Promise<StartlistSnapshot>;
}

export class AssignPlayerOrderService
  extends StartlistCommandBase
  implements AssignPlayerOrderUseCase
{
  constructor(
    repository: StartlistRepository,
    versionRepository: StartlistVersionRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, versionRepository, transactionManager, eventPublisher);
  }

  async execute(command: AssignPlayerOrderCommand): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(command.startlistId, (startlist) => {
      const assignments = toClassAssignments(command.assignments);
      startlist.assignPlayerOrderAndIntervals(assignments);
    });
  }
}
