import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistDiffDto,
  StartlistSettingsDto,
  StartlistVersionSummaryDto,
  StartlistWithHistoryDto,
} from '@startlist-management/application';
import type {
  ClassOrderPreferences,
  ClassOrderWarning,
  ClassSplitResult,
  ClassSplitRules,
  Entry,
  EventContext,
  StartOrderRules,
  StartlistState,
  StatusKey,
  StatusMessageState,
  WorldRankingMap,
} from '../types';
import {
  initialEntriesState,
  entriesReducer,
  type EntriesAction,
  ensureEntryId,
  ensureEntryIds,
  type EntryInput,
} from './entriesSlice';
import {
  initialLanesState,
  lanesReducer,
  type LanesReducerContext,
  type LanesAction,
  createLaneAssignmentAction as createLaneAssignmentActionInternal,
} from './lanesSlice';
import {
  createInitialStatusState,
  statusReducer,
  type StatusAction,
  createStatus,
} from './statusSlice';
import {
  initialClassSplitState,
  classSplitReducer,
  type ClassSplitAction,
  shouldResetForSplitChange,
} from './classSplitSlice';

export const createDefaultStartlistId = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `SL-${year}${month}${day}`;
};

export const createInitialStartlistState = (): StartlistState => {
  const statusState = createInitialStatusState();
  return {
    startlistId: createDefaultStartlistId(),
    settings: undefined,
    entries: initialEntriesState,
    ...initialLanesState,
    classOrderPreferences: { avoidConsecutiveClubs: true },
    snapshot: undefined,
    versionHistory: [],
    latestVersion: undefined,
    previousVersion: undefined,
    diff: undefined,
    statuses: statusState.statuses,
    loading: statusState.loading,
    startOrderRules: [],
    worldRankingByClass: new Map(),
    ...initialClassSplitState,
    eventContext: {},
  };
};

export type SettingsAction = {
  type: 'settings/set';
  payload: { startlistId: string; settings: StartlistSettingsDto; snapshot?: StartlistWithHistoryDto };
};

export type SnapshotAction = { type: 'settings/setSnapshot'; payload?: StartlistWithHistoryDto };

export type VersionHistoryAction = {
  type: 'versions/setHistory';
  payload: StartlistVersionSummaryDto[];
};

export type DiffAction = { type: 'versions/setDiff'; payload?: StartlistDiffDto };

export type PreferencesAction = {
  type: 'preferences/setClassOrder';
  payload: ClassOrderPreferences;
};

export type StartOrderAction = {
  type: 'startOrder/setRules';
  payload: StartOrderRules;
};

export type WorldRankingAction =
  | { type: 'worldRanking/set'; payload: { classId: string; ranking: [string, number][] } }
  | { type: 'worldRanking/remove'; payload: { classId: string } };

export type EventContextAction = { type: 'context/setEvent'; payload: EventContext };

export type StartlistAction =
  | EntriesAction
  | LanesAction
  | StatusAction
  | ClassSplitAction
  | SettingsAction
  | SnapshotAction
  | PreferencesAction
  | StartOrderAction
  | WorldRankingAction
  | VersionHistoryAction
  | DiffAction
  | EventContextAction;

const createVersionState = (
  versions: StartlistVersionSummaryDto[],
): Pick<StartlistState, 'versionHistory' | 'latestVersion' | 'previousVersion'> => {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  return {
    versionHistory: sorted,
    latestVersion: sorted[0],
    previousVersion: sorted[1],
  };
};

export const startlistReducer = (
  state: StartlistState,
  action: StartlistAction,
): StartlistState => {
  switch (action.type) {
    case 'entries/add':
    case 'entries/remove':
    case 'entries/update':
    case 'entries/set': {
      const entries = entriesReducer(state.entries, action);
      return { ...state, entries };
    }
    case 'lanes/setLaneAssignments':
    case 'lanes/setClassAssignments':
    case 'lanes/setStartTimes': {
      const context: LanesReducerContext = {
        startlistId: state.startlistId,
        entries: state.entries,
      };
      const next = lanesReducer(
        {
          laneAssignments: state.laneAssignments,
          classAssignments: state.classAssignments,
          classOrderSeed: state.classOrderSeed,
          classOrderWarnings: state.classOrderWarnings,
          startTimes: state.startTimes,
        },
        action,
        context,
      );
      return {
        ...state,
        laneAssignments: next.laneAssignments,
        classAssignments: next.classAssignments,
        classOrderSeed: next.classOrderSeed,
        classOrderWarnings: next.classOrderWarnings,
        startTimes: next.startTimes,
      };
    }
    case 'status/setStatus':
    case 'status/setLoading': {
      const next = statusReducer(
        {
          statuses: state.statuses,
          loading: state.loading,
        },
        action,
      );
      return {
        ...state,
        statuses: next.statuses,
        loading: next.loading,
      };
    }
    case 'classSplit/setRules':
    case 'classSplit/setResult': {
      const next = classSplitReducer(
        {
          classSplitRules: state.classSplitRules,
          classSplitResult: state.classSplitResult,
        },
        action,
      );

      const shouldReset =
        action.type === 'classSplit/setResult'
          ? shouldResetForSplitChange(state.classSplitResult, action.payload)
          : false;

      return {
        ...state,
        classSplitRules: next.classSplitRules,
        classSplitResult: next.classSplitResult,
        ...(shouldReset ? { ...initialLanesState } : {}),
      };
    }
    case 'settings/set':
      return {
        ...state,
        startlistId: action.payload.startlistId,
        settings: action.payload.settings,
        snapshot: action.payload.snapshot ?? state.snapshot,
        ...(action.payload.snapshot?.versions
          ? createVersionState(action.payload.snapshot.versions)
          : {}),
        ...(action.payload.snapshot?.diff ? { diff: action.payload.snapshot.diff } : {}),
      };
    case 'settings/setSnapshot':
      if (!action.payload) {
        return {
          ...state,
          snapshot: undefined,
          versionHistory: [],
          latestVersion: undefined,
          previousVersion: undefined,
          diff: undefined,
        };
      }
      return {
        ...state,
        snapshot: action.payload,
        ...(action.payload.versions ? createVersionState(action.payload.versions) : {}),
        ...(action.payload.diff ? { diff: action.payload.diff } : {}),
      };
    case 'preferences/setClassOrder':
      return {
        ...state,
        classOrderPreferences: action.payload,
      };
    case 'startOrder/setRules':
      return {
        ...state,
        startOrderRules: action.payload,
      };
    case 'worldRanking/set': {
      const next = new Map(state.worldRankingByClass);
      next.set(action.payload.classId, new Map<string, number>(action.payload.ranking));
      return {
        ...state,
        worldRankingByClass: next,
      };
    }
    case 'worldRanking/remove': {
      const next = new Map(state.worldRankingByClass);
      next.delete(action.payload.classId);
      return {
        ...state,
        worldRankingByClass: next,
      };
    }
    case 'versions/setHistory': {
      if (action.payload.length === 0) {
        return {
          ...state,
          versionHistory: [],
          latestVersion: undefined,
          previousVersion: undefined,
        };
      }
      return {
        ...state,
        ...createVersionState(action.payload),
      };
    }
    case 'versions/setDiff':
      return {
        ...state,
        diff: action.payload,
      };
    case 'context/setEvent':
      return {
        ...state,
        eventContext: action.payload,
      };
    default:
      return state;
  }
};

export const createLaneAssignmentAction = (
  assignments: LaneAssignmentDto[],
): LanesAction => createLaneAssignmentActionInternal(assignments);

export const createClassAssignmentsAction = (
  assignments: ClassAssignmentDto[],
  seed?: string,
  warnings?: ClassOrderWarning[],
): LanesAction => ({
  type: 'lanes/setClassAssignments',
  payload: { assignments, seed, warnings },
});

export const createStartTimesAction = (startTimes: StartTimeDto[]): LanesAction => ({
  type: 'lanes/setStartTimes',
  payload: startTimes,
});

export const createSetStatusAction = (
  key: StatusKey,
  status: StatusMessageState,
): StatusAction => ({
  type: 'status/setStatus',
  payload: { key, status },
});

export const createSetLoadingAction = (
  key: StatusKey,
  value: boolean,
): StatusAction => ({
  type: 'status/setLoading',
  payload: { key, value },
});

export const createEntriesActions = {
  add: (entry: EntryInput): EntriesAction => ({ type: 'entries/add', payload: entry }),
  remove: (id: string): EntriesAction => ({ type: 'entries/remove', payload: { id } }),
  update: (entry: Entry): EntriesAction => ({ type: 'entries/update', payload: entry }),
  set: (entries: EntryInput[]): EntriesAction => ({ type: 'entries/set', payload: entries }),
};

export const createSetSettingsAction = (
  payload: SettingsAction['payload'],
): SettingsAction => ({
  type: 'settings/set',
  payload,
});

export const createSetSnapshotAction = (snapshot?: StartlistWithHistoryDto): SnapshotAction => ({
  type: 'settings/setSnapshot',
  payload: snapshot,
});

export const createSetVersionHistoryAction = (
  versions: StartlistVersionSummaryDto[],
): VersionHistoryAction => ({
  type: 'versions/setHistory',
  payload: versions,
});

export const createSetDiffAction = (diff?: StartlistDiffDto): DiffAction => ({
  type: 'versions/setDiff',
  payload: diff,
});

export const createSetClassOrderPreferencesAction = (
  preferences: ClassOrderPreferences,
): PreferencesAction => ({
  type: 'preferences/setClassOrder',
  payload: preferences,
});

export const createSetStartOrderRulesAction = (
  rules: StartOrderRules,
): StartOrderAction => ({
  type: 'startOrder/setRules',
  payload: rules,
});

export const createSetClassWorldRankingAction = (
  classId: string,
  worldRanking: WorldRankingMap,
): WorldRankingAction => ({
  type: 'worldRanking/set',
  payload: { classId, ranking: Array.from(worldRanking.entries()) },
});

export const createRemoveClassWorldRankingAction = (
  classId: string,
): WorldRankingAction => ({
  type: 'worldRanking/remove',
  payload: { classId },
});

export const createSetClassSplitRulesAction = (
  rules: ClassSplitRules,
): ClassSplitAction => ({
  type: 'classSplit/setRules',
  payload: rules,
});

export const createSetClassSplitResultAction = (
  result: ClassSplitResult | undefined,
): ClassSplitAction => ({
  type: 'classSplit/setResult',
  payload: result,
});

export const createSetEventContextAction = (eventContext: EventContext): EventContextAction => ({
  type: 'context/setEvent',
  payload: eventContext,
});

export { ensureEntryId, ensureEntryIds, createStatus };
