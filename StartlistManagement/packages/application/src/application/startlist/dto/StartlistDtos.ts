export interface DurationDto {
  milliseconds: number;
}

export interface StartlistSettingsDto {
  eventId: string;
  startTime: Date | string;
  laneClassInterval: DurationDto;
  classPlayerInterval: DurationDto;
  laneCount: number;
}

export interface LaneAssignmentDto {
  laneNumber: number;
  classOrder: string[];
  interval: DurationDto;
}

export interface ClassAssignmentDto {
  classId: string;
  playerOrder: string[];
  interval: DurationDto;
}

export interface StartTimeDto {
  playerId: string;
  startTime: Date | string;
  laneNumber: number;
}

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

export interface GetStartlistQuery {
  startlistId: string;
}
