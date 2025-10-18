import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
} from '@startlist-management/application';

export type ClassSplitMethod = string;

export interface ClassSplitRule {
  baseClassId: string;
  partCount: number;
  method: ClassSplitMethod;
}

export type ClassSplitRules = ClassSplitRule[];

export interface SplitClassMetadata {
  classId: string;
  baseClassId: string;
  splitIndex: number;
  displayName?: string;
}

export interface ClassSplitResult {
  signature: string;
  splitClasses: SplitClassMetadata[];
  entryToSplitId: Map<string, string>;
  splitIdToEntryIds: Map<string, string[]>;
}

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
  | 'startOrder'
  | 'classSplit';

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

export type StartOrderMethod = 'random' | 'worldRanking';

export interface StartOrderRule {
  id: string;
  classId?: string;
  method: StartOrderMethod;
  csvName?: string;
}

export type StartOrderRules = StartOrderRule[];

export type WorldRankingByClass = Map<string, WorldRankingMap>;

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
  startOrderRules: StartOrderRules;
  worldRankingByClass: WorldRankingByClass;
  classSplitRules: ClassSplitRule[];
  classSplitResult?: ClassSplitResult;
}
