import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository.js';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot.js';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { toLaneAssignments } from '../dto/StartlistMappers.js';
import { ManuallyReassignLaneOrderCommand } from '../dto/StartlistDtos.js';
import { InvalidCommandError } from '../errors.js';
import { StartlistCommandBase } from './StartlistCommandBase.js';

export interface ManuallyReassignLaneOrderUseCase {
  execute(command: ManuallyReassignLaneOrderCommand): Promise<StartlistSnapshot>;
}

export class ManuallyReassignLaneOrderService
  extends StartlistCommandBase
  implements ManuallyReassignLaneOrderUseCase
{
  constructor(
    repository: StartlistRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, transactionManager, eventPublisher);
  }

  async execute(command: ManuallyReassignLaneOrderCommand): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(command.startlistId, (startlist) => {
      const settings = startlist.getSettings();
      if (!settings) {
        throw new InvalidCommandError('Startlist settings must be entered before reassigning lane order.');
      }
      const assignments = toLaneAssignments(command.assignments, settings.laneCount);
      startlist.manuallyReassignLaneOrder(assignments, command.reason);
    });
  }
}
