import { StartlistRepository, StartlistSnapshot } from '@startlist-management/domain';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { toLaneAssignments } from '../dto/StartlistMappers.js';
import { AssignLaneOrderCommand } from '../dto/StartlistDtos.js';
import { InvalidCommandError } from '../errors.js';
import { StartlistCommandBase } from './StartlistCommandBase.js';

export interface AssignLaneOrderUseCase {
  execute(command: AssignLaneOrderCommand): Promise<StartlistSnapshot>;
}

export class AssignLaneOrderService extends StartlistCommandBase implements AssignLaneOrderUseCase {
  constructor(
    repository: StartlistRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, transactionManager, eventPublisher);
  }

  async execute(command: AssignLaneOrderCommand): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(command.startlistId, (startlist) => {
      const settings = startlist.getSettings();
      if (!settings) {
        throw new InvalidCommandError('Startlist settings must be entered before assigning lane order.');
      }
      const assignments = toLaneAssignments(command.assignments, settings.laneCount);
      startlist.assignLaneOrderAndIntervals(assignments);
    });
  }
}
