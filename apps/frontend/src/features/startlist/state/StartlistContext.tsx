import { useReducer, type Dispatch, type PropsWithChildren } from 'react';
import { createContext, useContextSelector } from 'use-context-selector';
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

type StartlistContextValue = {
  state: StartlistState;
  dispatch: Dispatch<StartlistAction>;
};

const StartlistContext = createContext<StartlistContextValue | undefined>(undefined);

export const StartlistProvider = ({ children }: PropsWithChildren) => {
  const [state, dispatch] = useReducer(startlistReducer, undefined, createInitialStartlistState);
  const contextValue: StartlistContextValue = { state, dispatch };

  return <StartlistContext.Provider value={contextValue}>{children}</StartlistContext.Provider>;
};

const useStartlistContextSelector = <Selected,>(
  selector: (value: StartlistContextValue) => Selected,
  errorMessage: string,
): Selected =>
  useContextSelector(StartlistContext, (value) => {
    if (value === undefined) {
      throw new Error(errorMessage);
    }
    return selector(value);
  });

const useStartlistStateSelector = <Selected,>(selector: (state: StartlistState) => Selected): Selected =>
  useStartlistContextSelector(({ state }) => selector(state), 'StartlistProvider の外部で state を参照することはできません。');

export const useStartlistDispatch = (): Dispatch<StartlistAction> =>
  useStartlistContextSelector(({ dispatch }) => dispatch, 'StartlistProvider の外部で dispatch を呼び出すことはできません。');

export const useStartlistState = (): StartlistState => useStartlistStateSelector((state) => state);

export const useStartlistStartlistId = (): StartlistState['startlistId'] =>
  useStartlistStateSelector((state) => state.startlistId);

export const useStartlistSettings = (): StartlistState['settings'] =>
  useStartlistStateSelector((state) => state.settings);

export const useStartlistEntries = (): StartlistState['entries'] =>
  useStartlistStateSelector((state) => state.entries);

export const useStartlistLaneAssignments = (): StartlistState['laneAssignments'] =>
  useStartlistStateSelector((state) => state.laneAssignments);

export const useStartlistClassAssignments = (): StartlistState['classAssignments'] =>
  useStartlistStateSelector((state) => state.classAssignments);

export const useStartlistClassOrderSeed = (): StartlistState['classOrderSeed'] =>
  useStartlistStateSelector((state) => state.classOrderSeed);

export const useStartlistClassOrderWarnings = (): StartlistState['classOrderWarnings'] =>
  useStartlistStateSelector((state) => state.classOrderWarnings);

export const useStartlistClassOrderPreferences = (): StartlistState['classOrderPreferences'] =>
  useStartlistStateSelector((state) => state.classOrderPreferences);

export const useStartlistStartTimes = (): StartlistState['startTimes'] =>
  useStartlistStateSelector((state) => state.startTimes);

export const useStartlistStatuses = (): StartlistState['statuses'] =>
  useStartlistStateSelector((state) => state.statuses);

export const useStartlistLoading = (): StartlistState['loading'] =>
  useStartlistStateSelector((state) => state.loading);

export const useStartlistSnapshot = (): StartlistState['snapshot'] =>
  useStartlistStateSelector((state) => state.snapshot);

export const useStartlistStartOrderRules = (): StartlistState['startOrderRules'] =>
  useStartlistStateSelector((state) => state.startOrderRules);

export const useStartlistWorldRankingByClass = (): StartlistState['worldRankingByClass'] =>
  useStartlistStateSelector((state) => state.worldRankingByClass);

export const useStartlistClassSplitRules = (): StartlistState['classSplitRules'] =>
  useStartlistStateSelector((state) => state.classSplitRules);

export const useStartlistClassSplitResult = (): StartlistState['classSplitResult'] =>
  useStartlistStateSelector((state) => state.classSplitResult);

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
