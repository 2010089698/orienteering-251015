import { ClassAssignment } from './ClassAssignment.js';
import { LaneAssignment } from './LaneAssignment.js';
import { StartTime } from './StartTime.js';
import { StartlistSettings } from './StartlistSettings.js';
import { StartlistStatus } from './StartlistStatus.js';

export interface StartlistSnapshot {
  readonly id: string;
  readonly settings: StartlistSettings | undefined;
  readonly laneAssignments: ReadonlyArray<LaneAssignment>;
  readonly classAssignments: ReadonlyArray<ClassAssignment>;
  readonly startTimes: ReadonlyArray<StartTime>;
  readonly status: StartlistStatus;
}
