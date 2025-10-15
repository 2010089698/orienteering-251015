import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot';
import { ApplicationEventPublisher } from '../../shared/event-publisher';
import { TransactionManager } from '../../shared/transaction';
import { toClassAssignments } from '../dto/StartlistMappers';
import { ManuallyFinalizeClassStartOrderCommand } from '../dto/StartlistDtos';
import { StartlistCommandBase } from './StartlistCommandBase';

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
