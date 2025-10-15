import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot';
import { ApplicationEventPublisher } from '../../shared/event-publisher';
import { TransactionManager } from '../../shared/transaction';
import { toLaneAssignments } from '../dto/StartlistMappers';
import { AssignLaneOrderCommand } from '../dto/StartlistDtos';
import { InvalidCommandError } from '../errors';
import { StartlistCommandBase } from './StartlistCommandBase';

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
