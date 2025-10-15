import { ClassAssignment } from './ClassAssignment';
import { LaneAssignment } from './LaneAssignment';
import { StartTime } from './StartTime';
import { StartlistSettings } from './StartlistSettings';
import { StartlistStatus } from './StartlistStatus';

export interface StartlistSnapshot {
  readonly id: string;
  readonly settings: StartlistSettings | undefined;
  readonly laneAssignments: ReadonlyArray<LaneAssignment>;
  readonly classAssignments: ReadonlyArray<ClassAssignment>;
  readonly startTimes: ReadonlyArray<StartTime>;
  readonly status: StartlistStatus;
}
