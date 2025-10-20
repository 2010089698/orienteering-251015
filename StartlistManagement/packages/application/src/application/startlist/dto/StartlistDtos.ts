import type {
  StartlistSettingsDto,
  LaneAssignmentDto,
  ClassAssignmentDto,
  StartTimeDto,
} from '@startlist-management/domain';

export type {
  DurationDto,
  StartlistIntervalsDto,
  StartlistSettingsDto,
  LaneAssignmentDto,
  ClassAssignmentDto,
  StartTimeDto,
} from '@startlist-management/domain';

export interface EnterStartlistSettingsCommand {
  startlistId: string;
  settings: StartlistSettingsDto;
}

export interface AssignLaneOrderCommand {
  startlistId: string;
  assignments: LaneAssignmentDto[];
}

export interface AssignPlayerOrderCommand {
  startlistId: string;
  assignments: ClassAssignmentDto[];
}

export interface AssignStartTimesCommand {
  startlistId: string;
  startTimes: StartTimeDto[];
}

export interface FinalizeStartlistCommand {
  startlistId: string;
}

export interface ManuallyReassignLaneOrderCommand {
  startlistId: string;
  assignments: LaneAssignmentDto[];
  reason?: string;
}

export interface ManuallyFinalizeClassStartOrderCommand {
  startlistId: string;
  assignments: ClassAssignmentDto[];
  reason?: string;
}

export interface InvalidateStartTimesCommand {
  startlistId: string;
  reason: string;
}
