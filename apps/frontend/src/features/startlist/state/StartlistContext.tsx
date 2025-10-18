import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
} from '@startlist-management/application';
import { deriveSeededRandomClassOrderSeed } from '../utils/classOrderPolicy';
import type {
  ClassOrderPreferences,
  ClassOrderWarning,
  Entry,
  EntryDraft,
  ClassSplitResult,
  ClassSplitRule,
  ClassSplitRules,
  StartlistState,
  StatusKey,
  StatusMessageState,
  StartOrderRules,
  WorldRankingMap,
} from './types';

export const createDefaultStartlistId = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `SL-${year}${month}${day}`;
};

const statusKeys: StatusKey[] = [
  'settings',
  'entries',
  'lanes',
  'classes',
  'startTimes',
  'snapshot',
  'startOrder',
];

const defaultStatus = (text = '待機中です。', level: StatusMessageState['level'] = 'idle'): StatusMessageState => ({
  level,
  text,
});

const initialStatuses: StartlistState['statuses'] = statusKeys.reduce(
  (acc, key) => ({
    ...acc,
    [key]: defaultStatus(),
  }),
  {} as StartlistState['statuses'],
);

const initialState: StartlistState = {
  startlistId: createDefaultStartlistId(),
  settings: undefined,
  entries: [],
  laneAssignments: [],
  classAssignments: [],
  classOrderSeed: undefined,
  classOrderWarnings: [],
  classOrderPreferences: { avoidConsecutiveClubs: true },
  startTimes: [],
  snapshot: undefined,
  statuses: initialStatuses,
  loading: {},
  startOrderRules: [],
  worldRankingByClass: new Map(),
  classSplitRules: [],
  classSplitResult: undefined,
};

type EntryInput = Entry | EntryDraft;

const hasEntryId = (entry: EntryInput): entry is Entry =>
  typeof (entry as Entry).id === 'string' && (entry as Entry).id.length > 0;

let entryIdCounter = 0;

export const generateEntryId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // fall back to incremental IDs below
    }
  }
  entryIdCounter += 1;
  return `entry-${Date.now()}-${entryIdCounter}`;
};

export const ensureEntryId = (entry: EntryInput): Entry => {
  if (hasEntryId(entry)) {
    return entry;
  }
  return {
    ...entry,
    id: generateEntryId(),
  };
};

export const ensureEntryIds = (entries: EntryInput[]): Entry[] => entries.map((entry) => ensureEntryId(entry));

type StartlistAction =
  | {
      type: 'SET_SETTINGS';
      payload: { startlistId: string; settings: StartlistSettingsDto; snapshot?: unknown };
    }
  | { type: 'SET_SNAPSHOT'; payload?: unknown }
  | { type: 'ADD_ENTRY'; payload: Entry }
  | { type: 'REMOVE_ENTRY'; payload: { id: string } }
  | { type: 'SET_ENTRIES'; payload: Entry[] }
  | { type: 'SET_LANE_ASSIGNMENTS'; payload: LaneAssignmentDto[] }
  | {
      type: 'SET_CLASS_ASSIGNMENTS';
      payload: { assignments: ClassAssignmentDto[]; seed?: string; warnings?: ClassOrderWarning[] };
    }
  | { type: 'SET_START_TIMES'; payload: StartTimeDto[] }
  | { type: 'SET_STATUS'; payload: { key: StatusKey; status: StatusMessageState } }
  | { type: 'SET_LOADING'; payload: { key: StatusKey; value: boolean } }
  | { type: 'SET_CLASS_ORDER_PREFERENCES'; payload: ClassOrderPreferences }
  | { type: 'SET_START_ORDER_RULES'; payload: StartOrderRules }
  | { type: 'SET_CLASS_WORLD_RANKING'; payload: { classId: string; ranking: [string, number][] } }
  | { type: 'REMOVE_CLASS_WORLD_RANKING'; payload: { classId: string } }
  | { type: 'SET_CLASS_SPLIT_RULES'; payload: ClassSplitRules }
  | { type: 'SET_CLASS_SPLIT_RESULT'; payload: ClassSplitResult | undefined };

const resetForSplitChange = (state: StartlistState): StartlistState => ({
  ...state,
  laneAssignments: [],
  classAssignments: [],
  classOrderSeed: undefined,
  classOrderWarnings: [],
  startTimes: [],
});

const startlistReducer = (state: StartlistState, action: StartlistAction): StartlistState => {
  switch (action.type) {
    case 'SET_SETTINGS':
      return {
        ...state,
        startlistId: action.payload.startlistId,
        settings: action.payload.settings,
        snapshot: action.payload.snapshot ?? state.snapshot,
      };
    case 'SET_SNAPSHOT':
      return { ...state, snapshot: action.payload };
    case 'ADD_ENTRY':
      return { ...state, entries: [...state.entries, action.payload] };
    case 'REMOVE_ENTRY':
      return {
        ...state,
        entries: state.entries.filter((entry) => entry.id !== action.payload.id),
      };
    case 'SET_ENTRIES':
      return { ...state, entries: action.payload };
    case 'SET_LANE_ASSIGNMENTS':
      if (!state.classAssignments.length || !state.classOrderSeed) {
        return { ...state, laneAssignments: action.payload };
      }
      {
        const derivedSeed = deriveSeededRandomClassOrderSeed({
          startlistId: state.startlistId,
          entries: state.entries,
          laneAssignments: action.payload,
        });
        if (derivedSeed === state.classOrderSeed) {
          return { ...state, laneAssignments: action.payload };
        }
        return {
          ...state,
          laneAssignments: action.payload,
          classAssignments: [],
          classOrderSeed: undefined,
          classOrderWarnings: [],
        };
      }
    case 'SET_CLASS_ASSIGNMENTS':
      return {
        ...state,
        classAssignments: action.payload.assignments,
        classOrderSeed: action.payload.seed ?? state.classOrderSeed,
        classOrderWarnings: action.payload.warnings ?? [],
      };
    case 'SET_START_TIMES':
      return { ...state, startTimes: action.payload };
    case 'SET_STATUS':
      return {
        ...state,
        statuses: {
          ...state.statuses,
          [action.payload.key]: action.payload.status,
        },
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value,
        },
      };
    case 'SET_CLASS_ORDER_PREFERENCES':
      return {
        ...state,
        classOrderPreferences: action.payload,
      };
    case 'SET_START_ORDER_RULES':
      return {
        ...state,
        startOrderRules: action.payload,
      };
    case 'SET_CLASS_WORLD_RANKING': {
      const next = new Map(state.worldRankingByClass);
      next.set(action.payload.classId, new Map<string, number>(action.payload.ranking));
      return {
        ...state,
        worldRankingByClass: next,
      };
    }
    case 'REMOVE_CLASS_WORLD_RANKING': {
      const next = new Map(state.worldRankingByClass);
      next.delete(action.payload.classId);
      return {
        ...state,
        worldRankingByClass: next,
      };
    }
    case 'SET_CLASS_SPLIT_RULES':
      return {
        ...state,
        classSplitRules: action.payload,
      };
    case 'SET_CLASS_SPLIT_RESULT': {
      const currentSignature = state.classSplitResult?.signature;
      const nextSignature = action.payload?.signature;
      const nextState =
        currentSignature === nextSignature
          ? state
          : resetForSplitChange(state);
      return {
        ...nextState,
        classSplitResult: action.payload,
      };
    }
    default:
      return state;
  }
};

const StartlistStateContext = createContext<StartlistState | undefined>(undefined);
const StartlistDispatchContext = createContext<React.Dispatch<StartlistAction> | undefined>(undefined);

export const StartlistProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(startlistReducer, initialState);

  const memoizedState = useMemo(() => state, [state]);

  return (
    <StartlistStateContext.Provider value={memoizedState}>
      <StartlistDispatchContext.Provider value={dispatch}>{children}</StartlistDispatchContext.Provider>
    </StartlistStateContext.Provider>
  );
};

export const useStartlistState = (): StartlistState => {
  const context = useContext(StartlistStateContext);
  if (!context) {
    throw new Error('useStartlistState は StartlistProvider 内で使用してください。');
  }
  return context;
};

export const useStartlistDispatch = (): React.Dispatch<StartlistAction> => {
  const context = useContext(StartlistDispatchContext);
  if (!context) {
    throw new Error('useStartlistDispatch は StartlistProvider 内で使用してください。');
  }
  return context;
};

export const createStatus = (text: string, level: StatusMessageState['level']): StatusMessageState => ({
  level,
  text,
});

export const setStatus = (
  dispatch: React.Dispatch<StartlistAction>,
  key: StatusKey,
  status: StatusMessageState,
): void => {
  dispatch({ type: 'SET_STATUS', payload: { key, status } });
};

export const setLoading = (
  dispatch: React.Dispatch<StartlistAction>,
  key: StatusKey,
  value: boolean,
): void => {
  dispatch({ type: 'SET_LOADING', payload: { key, value } });
};

export const appendEntry = (
  dispatch: React.Dispatch<StartlistAction>,
  entry: EntryInput,
): void => {
  dispatch({ type: 'ADD_ENTRY', payload: ensureEntryId(entry) });
};

export const removeEntry = (
  dispatch: React.Dispatch<StartlistAction>,
  id: string,
): void => {
  dispatch({ type: 'REMOVE_ENTRY', payload: { id } });
};

export const updateEntries = (
  dispatch: React.Dispatch<StartlistAction>,
  entries: EntryInput[],
): void => {
  dispatch({ type: 'SET_ENTRIES', payload: ensureEntryIds(entries) });
};

export const updateLaneAssignments = (
  dispatch: React.Dispatch<StartlistAction>,
  assignments: LaneAssignmentDto[],
  splitResult?: ClassSplitResult,
): void => {
  if (splitResult) {
    setClassSplitResult(dispatch, splitResult);
  }
  dispatch({ type: 'SET_LANE_ASSIGNMENTS', payload: assignments });
};

export const updateClassAssignments = (
  dispatch: React.Dispatch<StartlistAction>,
  assignments: ClassAssignmentDto[],
  seed?: string,
  warnings?: ClassOrderWarning[],
  splitResult?: ClassSplitResult,
): void => {
  if (splitResult) {
    setClassSplitResult(dispatch, splitResult);
  }
  dispatch({ type: 'SET_CLASS_ASSIGNMENTS', payload: { assignments, seed, warnings } });
};

export const updateStartTimes = (
  dispatch: React.Dispatch<StartlistAction>,
  startTimes: StartTimeDto[],
  splitResult?: ClassSplitResult,
): void => {
  if (splitResult) {
    setClassSplitResult(dispatch, splitResult);
  }
  dispatch({ type: 'SET_START_TIMES', payload: startTimes });
};

export const updateSettings = (
  dispatch: React.Dispatch<StartlistAction>,
  payload: { startlistId: string; settings: StartlistSettingsDto; snapshot?: unknown },
): void => {
  dispatch({ type: 'SET_SETTINGS', payload });
};

export const updateSnapshot = (
  dispatch: React.Dispatch<StartlistAction>,
  snapshot?: unknown,
): void => {
  dispatch({ type: 'SET_SNAPSHOT', payload: snapshot });
};

export const updateClassOrderPreferences = (
  dispatch: React.Dispatch<StartlistAction>,
  preferences: ClassOrderPreferences,
): void => {
  dispatch({ type: 'SET_CLASS_ORDER_PREFERENCES', payload: preferences });
};

export const setStartOrderRules = (
  dispatch: React.Dispatch<StartlistAction>,
  rules: StartOrderRules,
): void => {
  dispatch({ type: 'SET_START_ORDER_RULES', payload: rules });
};

export const updateClassWorldRanking = (
  dispatch: React.Dispatch<StartlistAction>,
  classId: string,
  worldRanking: WorldRankingMap,
): void => {
  dispatch({
    type: 'SET_CLASS_WORLD_RANKING',
    payload: { classId, ranking: Array.from(worldRanking.entries()) },
  });
};

export const removeClassWorldRanking = (
  dispatch: React.Dispatch<StartlistAction>,
  classId: string,
): void => {
  dispatch({ type: 'REMOVE_CLASS_WORLD_RANKING', payload: { classId } });
};

export const setClassSplitRules = (
  dispatch: React.Dispatch<StartlistAction>,
  rules: ClassSplitRules,
): void => {
  dispatch({ type: 'SET_CLASS_SPLIT_RULES', payload: rules });
};

export const setClassSplitResult = (
  dispatch: React.Dispatch<StartlistAction>,
  result: ClassSplitResult | undefined,
): void => {
  dispatch({ type: 'SET_CLASS_SPLIT_RESULT', payload: result });
};
