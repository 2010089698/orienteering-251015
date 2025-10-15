import { StartlistRepository, StartlistSnapshot } from '@startlist-management/domain';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { toClassAssignments } from '../dto/StartlistMappers.js';
import { ManuallyFinalizeClassStartOrderCommand } from '../dto/StartlistDtos.js';
import { StartlistCommandBase } from './StartlistCommandBase.js';

export interface ManuallyFinalizeClassStartOrderUseCase {
  execute(command: ManuallyFinalizeClassStartOrderCommand): Promise<StartlistSnapshot>;
}

export class ManuallyFinalizeClassStartOrderService
  extends StartlistCommandBase
  implements ManuallyFinalizeClassStartOrderUseCase
{
  constructor(
    repository: StartlistRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, transactionManager, eventPublisher);
  }

  async execute(
    command: ManuallyFinalizeClassStartOrderCommand,
  ): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(command.startlistId, (startlist) => {
      const assignments = toClassAssignments(command.assignments);
      startlist.manuallyFinalizeClassStartOrder(assignments, command.reason);
    });
  }
}
