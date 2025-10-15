import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
} from '@startlist-management/application';

export type StatusLevel = 'idle' | 'info' | 'success' | 'error';

export interface StatusMessageState {
  level: StatusLevel;
  text: string;
}

export type StatusKey = 'settings' | 'entries' | 'lanes' | 'classes' | 'startTimes' | 'snapshot';

export interface Entry {
  name: string;
  club?: string;
  classId: string;
  cardNo: string;
}

export interface StartlistState {
  startlistId: string;
  settings?: StartlistSettingsDto;
  entries: Entry[];
  laneAssignments: LaneAssignmentDto[];
  classAssignments: ClassAssignmentDto[];
  startTimes: StartTimeDto[];
  snapshot?: unknown;
  statuses: Record<StatusKey, StatusMessageState>;
  loading: Partial<Record<StatusKey, boolean>>;
}
