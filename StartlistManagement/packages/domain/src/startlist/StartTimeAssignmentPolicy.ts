import { ClassAssignment } from './ClassAssignment.js';
import { StartTime } from './StartTime.js';
import { StartlistSettings } from './StartlistSettings.js';
import {
  ClassAssignmentsNotCompletedError,
  StartlistSettingsNotEnteredError,
} from './StartlistErrors.js';
import { DomainError } from '../common/DomainError.js';

export interface StartTimeAssignmentPolicyContext {
  readonly startTimes: ReadonlyArray<StartTime>;
  readonly settings?: StartlistSettings;
  readonly classAssignments: ReadonlyArray<ClassAssignment>;
}

export class StartTimeAssignmentPolicy {
  static ensureCanAssign({ startTimes, settings, classAssignments }: StartTimeAssignmentPolicyContext): void {
    if (!settings) {
      throw new StartlistSettingsNotEnteredError();
    }

    if (classAssignments.length === 0) {
      throw new ClassAssignmentsNotCompletedError();
    }

    if (startTimes.length === 0) {
      throw new DomainError('At least one start time must be provided.');
    }

    const allowedPlayerIds = new Set<string>(
      classAssignments.flatMap((assignment) => assignment.playerOrder),
    );

    const playerIds = new Set<string>();
    const laneCount = settings.laneCount;

    startTimes.forEach((startTime) => {
      if (playerIds.has(startTime.playerId)) {
        throw new DomainError('Start times must be unique per player.');
      }

      if (!allowedPlayerIds.has(startTime.playerId)) {
        throw new DomainError(
          `Player ${startTime.playerId} does not have a class assignment and cannot receive a start time.`,
        );
      }

      if (startTime.laneNumber > laneCount) {
        throw new DomainError('Start time lane number exceeds configured lane count.');
      }

      playerIds.add(startTime.playerId);
    });
  }
}
