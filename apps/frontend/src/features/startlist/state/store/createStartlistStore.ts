import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
} from '@startlist-management/application';
import type {
  ClassOrderPreferences,
  ClassOrderWarning,
  ClassSplitResult,
  ClassSplitRules,
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

const createInitialState = (): StartlistState => {
  const statusState = createInitialStatusState();
  return {
    startlistId: createDefaultStartlistId(),
    settings: undefined,
    entries: initialEntriesState,
    ...initialLanesState,
    classOrderPreferences: { avoidConsecutiveClubs: true },
    snapshot: undefined,
    statuses: statusState.statuses,
    loading: statusState.loading,
    startOrderRules: [],
    worldRankingByClass: new Map(),
    ...initialClassSplitState,
  };
};

export type SettingsAction = {
  type: 'settings/set';
  payload: { startlistId: string; settings: StartlistSettingsDto; snapshot?: unknown };
};

export type SnapshotAction = { type: 'settings/setSnapshot'; payload?: unknown };

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

export type StartlistAction =
  | EntriesAction
  | LanesAction
  | StatusAction
  | ClassSplitAction
  | SettingsAction
  | SnapshotAction
  | PreferencesAction
  | StartOrderAction
  | WorldRankingAction;

const startlistReducer = (state: StartlistState, action: StartlistAction): StartlistState => {
  switch (action.type) {
    case 'entries/add':
    case 'entries/remove':
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
      };
    case 'settings/setSnapshot':
      return {
        ...state,
        snapshot: action.payload,
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
    default:
      return state;
  }
};

export interface StartlistStore {
  getState: () => StartlistState;
  dispatch: (action: StartlistAction) => void;
  subscribe: (listener: () => void) => () => void;
}

export const createStartlistStore = (
  initialState: StartlistState = createInitialState(),
): StartlistStore => {
  let state = initialState;
  const listeners = new Set<() => void>();

  const getState = (): StartlistState => state;

  const dispatch = (action: StartlistAction): void => {
    const nextState = startlistReducer(state, action);
    if (nextState === state) {
      return;
    }
    state = nextState;
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getState,
    dispatch,
    subscribe,
  };
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
  set: (entries: EntryInput[]): EntriesAction => ({ type: 'entries/set', payload: entries }),
};

export const createSetSettingsAction = (
  payload: SettingsAction['payload'],
): SettingsAction => ({
  type: 'settings/set',
  payload,
});

export const createSetSnapshotAction = (snapshot?: unknown): SnapshotAction => ({
  type: 'settings/setSnapshot',
  payload: snapshot,
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

export { ensureEntryId, ensureEntryIds, createStatus };
