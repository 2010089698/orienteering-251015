import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
} from '@startlist-management/application';
import type {
  StartlistDiffDto,
  StartlistVersionSummaryDto,
  StartlistWithHistoryDto,
} from '@startlist-management/application';

export type ClassSplitMethod = 'random' | 'rankingTopBottom' | 'rankingBalanced';

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

export interface JapanRankingSettings {
  categoryId: string;
  pages: number;
  pagesRaw?: string;
  fetchedCount?: number;
}

export type StartOrderMethod = 'random' | 'worldRanking' | 'japanRanking';

export interface StartOrderRule {
  id: string;
  classId?: string;
  method: StartOrderMethod;
  csvName?: string;
  japanRanking?: JapanRankingSettings;
}

export type StartOrderRules = StartOrderRule[];

export type WorldRankingByClass = Map<string, WorldRankingMap>;

export interface EventContext {
  eventId?: string;
  raceId?: string;
}

export type EventLinkStatusState = 'idle' | 'linking' | 'success' | 'error';

export interface EventLinkStatus {
  status: EventLinkStatusState;
  eventId?: string;
  raceId?: string;
  startlistId?: string;
  startlistLink?: string;
  startlistUpdatedAt?: string;
  startlistPublicVersion?: number;
  errorMessage?: string;
}

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
  snapshot?: StartlistWithHistoryDto;
  versionHistory: StartlistVersionSummaryDto[];
  latestVersion?: StartlistVersionSummaryDto;
  previousVersion?: StartlistVersionSummaryDto;
  diff?: StartlistDiffDto;
  statuses: Record<StatusKey, StatusMessageState>;
  loading: Partial<Record<StatusKey, boolean>>;
  startOrderRules: StartOrderRules;
  worldRankingByClass: WorldRankingByClass;
  classSplitRules: ClassSplitRule[];
  classSplitResult?: ClassSplitResult;
  eventContext: EventContext;
  eventLinkStatus: EventLinkStatus;
}
