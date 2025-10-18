import {
  DomainEvent,
  ClassStartOrderManuallyFinalizedEvent,
  LaneOrderManuallyReassignedEvent,
} from '@startlist-management/domain';
import { InvalidateStartTimesCommand } from '../dto/StartlistDtos.js';
import { NoStartTimesAssignedInvalidCommandError, mapToApplicationError } from '../errors.js';
import { InvalidateStartTimesUseCase } from '../commands/InvalidateStartTimesUseCase.js';

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
      if (appError instanceof NoStartTimesAssignedInvalidCommandError) {
        return;
      }
      throw appError;
    }
  }
}
