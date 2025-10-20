import {
  StartlistRepository,
  StartlistSnapshot,
  StartlistVersionRepository,
} from '@startlist-management/domain';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { toLaneAssignments } from '../dto/StartlistMappers.js';
import { AssignLaneOrderCommand } from '../dto/StartlistDtos.js';
import { StartlistCommandBase } from './StartlistCommandBase.js';

export interface AssignLaneOrderUseCase {
  execute(command: AssignLaneOrderCommand): Promise<StartlistSnapshot>;
}

export class AssignLaneOrderService extends StartlistCommandBase implements AssignLaneOrderUseCase {
  constructor(
    repository: StartlistRepository,
    versionRepository: StartlistVersionRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
  ) {
    super(repository, versionRepository, transactionManager, eventPublisher);
  }

  async execute(command: AssignLaneOrderCommand): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(command.startlistId, (startlist) => {
      const laneCount = startlist.getSettingsOrThrow().laneCount;
      const assignments = toLaneAssignments(command.assignments, laneCount);
      startlist.assignLaneOrderAndIntervals(assignments);
    });
  }
}
