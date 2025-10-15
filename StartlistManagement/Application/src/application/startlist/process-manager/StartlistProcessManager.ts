import { DomainEvent } from '../../../../../Domain/src/common/DomainEvent.js';
import { ClassStartOrderManuallyFinalizedEvent } from '../../../../../Domain/src/startlist/events/ClassStartOrderManuallyFinalizedEvent.js';
import { LaneOrderManuallyReassignedEvent } from '../../../../../Domain/src/startlist/events/LaneOrderManuallyReassignedEvent.js';
import { InvalidateStartTimesCommand } from '../dto/StartlistDtos.js';
import { InvalidCommandError, mapToApplicationError } from '../errors.js';
import { InvalidateStartTimesUseCase } from '../commands/InvalidateStartTimesUseCase.js';

const NO_START_TIMES_MESSAGE = 'No start times are assigned to invalidate.';

export class StartlistProcessManager {
  constructor(private readonly invalidateStartTimes: InvalidateStartTimesUseCase) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event instanceof LaneOrderManuallyReassignedEvent) {
      await this.invalidateForManualChange(event.startlistId, 'Lane order manually reassigned');
      return;
    }
    if (event instanceof ClassStartOrderManuallyFinalizedEvent) {
      await this.invalidateForManualChange(event.startlistId, 'Class start order manually finalized');
      return;
    }
  }

  private async invalidateForManualChange(startlistId: string, reason: string): Promise<void> {
    const command: InvalidateStartTimesCommand = { startlistId, reason };
    try {
      await this.invalidateStartTimes.execute(command);
    } catch (error) {
      const appError = mapToApplicationError(error);
      if (appError instanceof InvalidCommandError && appError.message === NO_START_TIMES_MESSAGE) {
        return;
      }
      throw appError;
    }
  }
}
