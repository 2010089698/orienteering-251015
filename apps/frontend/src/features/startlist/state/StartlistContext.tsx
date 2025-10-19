import React, { createContext, useContext, useMemo, useReducer, type Dispatch } from 'react';
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
  startlistReducer,
  createInitialStartlistState,
  type StartlistAction,
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

const StartlistStateContext = createContext<StartlistState | undefined>(undefined);
const StartlistDispatchContext = createContext<Dispatch<StartlistAction> | undefined>(undefined);

export const StartlistProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(startlistReducer, undefined, createInitialStartlistState);

  const stateValue = useMemo(() => state, [state]);

  return (
    <StartlistStateContext.Provider value={stateValue}>
      <StartlistDispatchContext.Provider value={dispatch}>{children}</StartlistDispatchContext.Provider>
    </StartlistStateContext.Provider>
  );
};

const useStartlistStateContext = (): StartlistState => {
  const state = useContext(StartlistStateContext);
  if (state === undefined) {
    throw new Error('StartlistProvider の外部で state を参照することはできません。');
  }
  return state;
};

const useStartlistDispatchContext = (): Dispatch<StartlistAction> => {
  const dispatch = useContext(StartlistDispatchContext);
  if (dispatch === undefined) {
    throw new Error('StartlistProvider の外部で dispatch を呼び出すことはできません。');
  }
  return dispatch;
};

export const useStartlistDispatch = (): Dispatch<StartlistAction> => useStartlistDispatchContext();

export const useStartlistState = (): StartlistState => useStartlistStateContext();

export const useStartlistStartlistId = (): StartlistState['startlistId'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.startlistId, [state.startlistId]);
};

export const useStartlistSettings = (): StartlistState['settings'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.settings, [state.settings]);
};

export const useStartlistEntries = (): StartlistState['entries'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.entries, [state.entries]);
};

export const useStartlistLaneAssignments = (): StartlistState['laneAssignments'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.laneAssignments, [state.laneAssignments]);
};

export const useStartlistClassAssignments = (): StartlistState['classAssignments'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.classAssignments, [state.classAssignments]);
};

export const useStartlistClassOrderSeed = (): StartlistState['classOrderSeed'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.classOrderSeed, [state.classOrderSeed]);
};

export const useStartlistClassOrderWarnings = (): StartlistState['classOrderWarnings'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.classOrderWarnings, [state.classOrderWarnings]);
};

export const useStartlistClassOrderPreferences = (): StartlistState['classOrderPreferences'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.classOrderPreferences, [state.classOrderPreferences]);
};

export const useStartlistStartTimes = (): StartlistState['startTimes'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.startTimes, [state.startTimes]);
};

export const useStartlistStatuses = (): StartlistState['statuses'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.statuses, [state.statuses]);
};

export const useStartlistLoading = (): StartlistState['loading'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.loading, [state.loading]);
};

export const useStartlistSnapshot = (): StartlistState['snapshot'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.snapshot, [state.snapshot]);
};

export const useStartlistStartOrderRules = (): StartlistState['startOrderRules'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.startOrderRules, [state.startOrderRules]);
};

export const useStartlistWorldRankingByClass = (): StartlistState['worldRankingByClass'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.worldRankingByClass, [state.worldRankingByClass]);
};

export const useStartlistClassSplitRules = (): StartlistState['classSplitRules'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.classSplitRules, [state.classSplitRules]);
};

export const useStartlistClassSplitResult = (): StartlistState['classSplitResult'] => {
  const state = useStartlistStateContext();
  return useMemo(() => state.classSplitResult, [state.classSplitResult]);
};

export const setStatus = (
  dispatch: Dispatch<StartlistAction>,
  key: StatusKey,
  status: StatusMessageState,
): void => {
  dispatch(createSetStatusAction(key, status));
};

export const setLoading = (
  dispatch: Dispatch<StartlistAction>,
  key: StatusKey,
  value: boolean,
): void => {
  dispatch(createSetLoadingAction(key, value));
};

export const appendEntry = (
  dispatch: Dispatch<StartlistAction>,
  entry: EntryInput,
): void => {
  dispatch(createEntriesActions.add(entry));
};

export const removeEntry = (
  dispatch: Dispatch<StartlistAction>,
  id: string,
): void => {
  dispatch(createEntriesActions.remove(id));
};

export const updateEntries = (
  dispatch: Dispatch<StartlistAction>,
  entries: EntryInput[],
): void => {
  dispatch(createEntriesActions.set(entries));
};

export const updateLaneAssignments = (
  dispatch: Dispatch<StartlistAction>,
  assignments: LaneAssignmentDto[],
  splitResult?: ClassSplitResult,
): void => {
  if (splitResult) {
    setClassSplitResult(dispatch, splitResult);
  }
  dispatch(createLaneAssignmentAction(assignments));
};

export const updateClassAssignments = (
  dispatch: Dispatch<StartlistAction>,
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
  dispatch: Dispatch<StartlistAction>,
  startTimes: StartTimeDto[],
  splitResult?: ClassSplitResult,
): void => {
  if (splitResult) {
    setClassSplitResult(dispatch, splitResult);
  }
  dispatch(createStartTimesAction(startTimes));
};

export const updateSettings = (
  dispatch: Dispatch<StartlistAction>,
  payload: { startlistId: string; settings: StartlistSettingsDto; snapshot?: unknown },
): void => {
  dispatch(createSetSettingsAction(payload));
};

export const updateSnapshot = (
  dispatch: Dispatch<StartlistAction>,
  snapshot?: unknown,
): void => {
  dispatch(createSetSnapshotAction(snapshot));
};

export const updateClassOrderPreferences = (
  dispatch: Dispatch<StartlistAction>,
  preferences: ClassOrderPreferences,
): void => {
  dispatch(createSetClassOrderPreferencesAction(preferences));
};

export const setStartOrderRules = (
  dispatch: Dispatch<StartlistAction>,
  rules: StartOrderRules,
): void => {
  dispatch(createSetStartOrderRulesAction(rules));
};

export const updateClassWorldRanking = (
  dispatch: Dispatch<StartlistAction>,
  classId: string,
  worldRanking: WorldRankingMap,
): void => {
  dispatch(createSetClassWorldRankingAction(classId, worldRanking));
};

export const removeClassWorldRanking = (
  dispatch: Dispatch<StartlistAction>,
  classId: string,
): void => {
  dispatch(createRemoveClassWorldRankingAction(classId));
};

export const setClassSplitRules = (
  dispatch: Dispatch<StartlistAction>,
  rules: ClassSplitRules,
): void => {
  dispatch(createSetClassSplitRulesAction(rules));
};

export const setClassSplitResult = (
  dispatch: Dispatch<StartlistAction>,
  result: ClassSplitResult | undefined,
): void => {
  dispatch(createSetClassSplitResultAction(result));
};

export { ensureEntryId, ensureEntryIds, createStatus, createDefaultStartlistId, generateEntryId };
