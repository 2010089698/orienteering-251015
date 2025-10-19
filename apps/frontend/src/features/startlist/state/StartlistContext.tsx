import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
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
  Entry,
  EntryDraft,
  StartlistState,
  StatusKey,
  StatusMessageState,
  StartOrderRules,
  WorldRankingMap,
} from './types';
import {
  createStartlistStore,
  type StartlistStore,
  createLaneAssignmentAction,
  createClassAssignmentsAction,
  createStartTimesAction,
  createSetStatusAction,
  createSetLoadingAction,
  createEntriesActions,
  createSetSettingsAction,
  createSetSnapshotAction,
  createSetClassOrderPreferencesAction,
  createSetStartOrderRulesAction,
  createSetClassWorldRankingAction,
  createRemoveClassWorldRankingAction,
  createSetClassSplitRulesAction,
  createSetClassSplitResultAction,
  ensureEntryId,
  ensureEntryIds,
  createStatus,
  createDefaultStartlistId,
} from './store/createStartlistStore';
import { generateEntryId } from './store/entriesSlice';

type EntryInput = Entry | EntryDraft;

type EqualityFn<T> = (a: T, b: T) => boolean;

const StartlistStoreContext = createContext<StartlistStore | undefined>(undefined);

export const StartlistProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const storeRef = useRef<StartlistStore>();

  if (!storeRef.current) {
    storeRef.current = createStartlistStore();
  }

  const store = storeRef.current;

  const contextValue = useMemo(() => store, [store]);

  return <StartlistStoreContext.Provider value={contextValue}>{children}</StartlistStoreContext.Provider>;
};

const useStartlistStoreInternal = (): StartlistStore => {
  const store = useContext(StartlistStoreContext);
  if (!store) {
    throw new Error('StartlistProvider の外部で state を参照することはできません。');
  }
  return store;
};

export const useStartlistStore = (): StartlistStore => useStartlistStoreInternal();

export const useStartlistDispatch = (): StartlistStore['dispatch'] => {
  const store = useStartlistStoreInternal();
  return store.dispatch;
};

export const useStartlistSelector = <T,>(
  selector: (state: StartlistState) => T,
  equalityFn: EqualityFn<T> = Object.is,
): T => {
  const store = useStartlistStoreInternal();
  const latestSelectionRef = useRef<T>();

  const getSelectedSnapshot = useCallback(() => {
    const next = selector(store.getState());
    const previous = latestSelectionRef.current;
    if (previous !== undefined && equalityFn(previous, next)) {
      return previous;
    }
    latestSelectionRef.current = next;
    return next;
  }, [equalityFn, selector, store]);

  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);

  return useSyncExternalStore(subscribe, getSelectedSnapshot, getSelectedSnapshot);
};

export const useStartlistState = (): StartlistState =>
  useStartlistSelector((state) => state, (a, b) => a === b);

export const useStartlistStartlistId = (): StartlistState['startlistId'] =>
  useStartlistSelector((state) => state.startlistId);

export const useStartlistSettings = (): StartlistState['settings'] =>
  useStartlistSelector((state) => state.settings);

export const useStartlistEntries = (): StartlistState['entries'] =>
  useStartlistSelector((state) => state.entries);

export const useStartlistLaneAssignments = (): StartlistState['laneAssignments'] =>
  useStartlistSelector((state) => state.laneAssignments);

export const useStartlistClassAssignments = (): StartlistState['classAssignments'] =>
  useStartlistSelector((state) => state.classAssignments);

export const useStartlistClassOrderSeed = (): StartlistState['classOrderSeed'] =>
  useStartlistSelector((state) => state.classOrderSeed);

export const useStartlistClassOrderWarnings = (): StartlistState['classOrderWarnings'] =>
  useStartlistSelector((state) => state.classOrderWarnings);

export const useStartlistClassOrderPreferences = (): StartlistState['classOrderPreferences'] =>
  useStartlistSelector((state) => state.classOrderPreferences);

export const useStartlistStartTimes = (): StartlistState['startTimes'] =>
  useStartlistSelector((state) => state.startTimes);

export const useStartlistStatuses = (): StartlistState['statuses'] =>
  useStartlistSelector((state) => state.statuses);

export const useStartlistLoading = (): StartlistState['loading'] =>
  useStartlistSelector((state) => state.loading);

export const useStartlistSnapshot = (): StartlistState['snapshot'] =>
  useStartlistSelector((state) => state.snapshot);

export const useStartlistStartOrderRules = (): StartlistState['startOrderRules'] =>
  useStartlistSelector((state) => state.startOrderRules);

export const useStartlistWorldRankingByClass = (): StartlistState['worldRankingByClass'] =>
  useStartlistSelector((state) => state.worldRankingByClass);

export const useStartlistClassSplitRules = (): StartlistState['classSplitRules'] =>
  useStartlistSelector((state) => state.classSplitRules);

export const useStartlistClassSplitResult = (): StartlistState['classSplitResult'] =>
  useStartlistSelector((state) => state.classSplitResult);

export const setStatus = (
  dispatch: StartlistStore['dispatch'],
  key: StatusKey,
  status: StatusMessageState,
): void => {
  dispatch(createSetStatusAction(key, status));
};

export const setLoading = (
  dispatch: StartlistStore['dispatch'],
  key: StatusKey,
  value: boolean,
): void => {
  dispatch(createSetLoadingAction(key, value));
};

export const appendEntry = (
  dispatch: StartlistStore['dispatch'],
  entry: EntryInput,
): void => {
  dispatch(createEntriesActions.add(entry));
};

export const removeEntry = (
  dispatch: StartlistStore['dispatch'],
  id: string,
): void => {
  dispatch(createEntriesActions.remove(id));
};

export const updateEntries = (
  dispatch: StartlistStore['dispatch'],
  entries: EntryInput[],
): void => {
  dispatch(createEntriesActions.set(entries));
};

export const updateLaneAssignments = (
  dispatch: StartlistStore['dispatch'],
  assignments: LaneAssignmentDto[],
  splitResult?: ClassSplitResult,
): void => {
  if (splitResult) {
    setClassSplitResult(dispatch, splitResult);
  }
  dispatch(createLaneAssignmentAction(assignments));
};

export const updateClassAssignments = (
  dispatch: StartlistStore['dispatch'],
  assignments: ClassAssignmentDto[],
  seed?: string,
  warnings?: ClassOrderWarning[],
  splitResult?: ClassSplitResult,
): void => {
  if (splitResult) {
    setClassSplitResult(dispatch, splitResult);
  }
  dispatch(createClassAssignmentsAction(assignments, seed, warnings));
};

export const updateStartTimes = (
  dispatch: StartlistStore['dispatch'],
  startTimes: StartTimeDto[],
  splitResult?: ClassSplitResult,
): void => {
  if (splitResult) {
    setClassSplitResult(dispatch, splitResult);
  }
  dispatch(createStartTimesAction(startTimes));
};

export const updateSettings = (
  dispatch: StartlistStore['dispatch'],
  payload: { startlistId: string; settings: StartlistSettingsDto; snapshot?: unknown },
): void => {
  dispatch(createSetSettingsAction(payload));
};

export const updateSnapshot = (
  dispatch: StartlistStore['dispatch'],
  snapshot?: unknown,
): void => {
  dispatch(createSetSnapshotAction(snapshot));
};

export const updateClassOrderPreferences = (
  dispatch: StartlistStore['dispatch'],
  preferences: ClassOrderPreferences,
): void => {
  dispatch(createSetClassOrderPreferencesAction(preferences));
};

export const setStartOrderRules = (
  dispatch: StartlistStore['dispatch'],
  rules: StartOrderRules,
): void => {
  dispatch(createSetStartOrderRulesAction(rules));
};

export const updateClassWorldRanking = (
  dispatch: StartlistStore['dispatch'],
  classId: string,
  worldRanking: WorldRankingMap,
): void => {
  dispatch(createSetClassWorldRankingAction(classId, worldRanking));
};

export const removeClassWorldRanking = (
  dispatch: StartlistStore['dispatch'],
  classId: string,
): void => {
  dispatch(createRemoveClassWorldRankingAction(classId));
};

export const setClassSplitRules = (
  dispatch: StartlistStore['dispatch'],
  rules: ClassSplitRules,
): void => {
  dispatch(createSetClassSplitRulesAction(rules));
};

export const setClassSplitResult = (
  dispatch: StartlistStore['dispatch'],
  result: ClassSplitResult | undefined,
): void => {
  dispatch(createSetClassSplitResultAction(result));
};

export { ensureEntryId, ensureEntryIds, createStatus, createDefaultStartlistId, generateEntryId };
