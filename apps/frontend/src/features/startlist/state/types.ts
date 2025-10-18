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

export type StatusKey =
  | 'settings'
  | 'entries'
  | 'lanes'
  | 'classes'
  | 'startTimes'
  | 'snapshot'
  | 'worldRanking';

interface EntryBase {
  name: string;
  club?: string;
  classId: string;
  cardNo: string;
  iofId?: string;
}

export interface Entry extends EntryBase {
  id: string;
}

export type EntryDraft = EntryBase;

export const RENTAL_CARD_LABEL = 'レンタル';

export interface ClassOrderWarningOccurrence {
  previousPlayerId: string;
  nextPlayerId: string;
  clubs: string[];
}

export interface ClassOrderWarning {
  classId: string;
  occurrences: ClassOrderWarningOccurrence[];
}

export interface ClassOrderPreferences {
  avoidConsecutiveClubs: boolean;
}

export type WorldRankingMap = Map<string, number>;

export type WorldRankingTargetClassIds = Set<string>;

export interface StartlistState {
  startlistId: string;
  settings?: StartlistSettingsDto;
  entries: Entry[];
  laneAssignments: LaneAssignmentDto[];
  classAssignments: ClassAssignmentDto[];
  classOrderSeed?: string;
  classOrderWarnings: ClassOrderWarning[];
  classOrderPreferences: ClassOrderPreferences;
  startTimes: StartTimeDto[];
  snapshot?: unknown;
  statuses: Record<StatusKey, StatusMessageState>;
  loading: Partial<Record<StatusKey, boolean>>;
  worldRanking: WorldRankingMap;
  worldRankingTargetClassIds: WorldRankingTargetClassIds;
}
