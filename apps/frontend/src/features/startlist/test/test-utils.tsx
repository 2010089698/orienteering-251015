import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { PropsWithChildren, useEffect, useLayoutEffect, type Dispatch } from 'react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import {
  StartlistProvider,
  useStartlistDispatch,
  createStatus,
  setStatus,
  setLoading,
  updateSettings,
  updateEntries,
  updateLaneAssignments,
  updateClassAssignments,
  updateStartTimes,
  updateSnapshot,
  updateClassOrderPreferences,
  setStartOrderRules,
  updateClassWorldRanking,
  setClassSplitRules,
  setClassSplitResult,
  useSetStartlistEditingEntryId,
  updateVersionHistory,
  updateDiff,
  setEventContext,
  setEventLinkStatus,
} from '../state/StartlistContext';
import type { StartlistAction } from '../state/store/createStartlistStore';
import type {
  StartlistSettingsDto,
  LaneAssignmentDto,
  ClassAssignmentDto,
  StartTimeDto,
  StartlistWithHistoryDto,
  StartlistVersionSummaryDto,
  StartlistDiffDto,
} from '@startlist-management/application';
import type {
  ClassOrderPreferences,
  ClassOrderWarning,
  Entry,
  ClassSplitResult,
  ClassSplitRule,
  StartOrderRules,
  StatusKey,
  StatusMessageState,
  EventContext,
  EventLinkStatus,
} from '../state/types';

export interface StartlistTestInitialState {
  startlistId?: string;
  settings?: StartlistSettingsDto;
  entries?: Entry[];
  laneAssignments?: LaneAssignmentDto[];
  classAssignments?: ClassAssignmentDto[];
  classOrderSeed?: string;
  classOrderWarnings?: ClassOrderWarning[];
  classOrderPreferences?: ClassOrderPreferences;
  startTimes?: StartTimeDto[];
  snapshot?: StartlistWithHistoryDto;
  statuses?: Partial<Record<StatusKey, StatusMessageState>>;
  loading?: Partial<Record<StatusKey, boolean>>;
  startOrderRules?: StartOrderRules;
  worldRankingEntriesByClass?: Record<string, [string, number][]>;
  classSplitRules?: ClassSplitRule[];
  classSplitResult?: ClassSplitResult;
  editingEntryId?: string;
  versionHistory?: StartlistVersionSummaryDto[];
  diff?: StartlistDiffDto;
  eventContext?: EventContext;
  eventLinkStatus?: EventLinkStatus;
}

interface WrapperProps {
  initialize?: (dispatch: Dispatch<StartlistAction>) => void;
  initialState?: StartlistTestInitialState;
}

const Initializer = ({ children, initialize, initialState }: PropsWithChildren<WrapperProps>) => {
  const dispatch = useStartlistDispatch();
  const setEditingEntryId = useSetStartlistEditingEntryId();

  useLayoutEffect(() => {
    if (initialState?.settings && initialState.startlistId) {
      updateSettings(dispatch, {
        startlistId: initialState.startlistId,
        settings: initialState.settings,
        snapshot: initialState.snapshot,
      });
    }
  }, [dispatch, initialState]);

  useLayoutEffect(() => {
    if (initialState?.eventContext) {
      setEventContext(dispatch, initialState.eventContext);
    }
  }, [dispatch, initialState]);

  useLayoutEffect(() => {
    if (initialState?.eventLinkStatus) {
      setEventLinkStatus(dispatch, initialState.eventLinkStatus);
    }
  }, [dispatch, initialState]);

  useLayoutEffect(() => {
    if (initialState?.entries) {
      updateEntries(dispatch, initialState.entries);
    }
    if (initialState?.classSplitRules) {
      setClassSplitRules(dispatch, initialState.classSplitRules);
    }
    if (initialState?.classSplitResult) {
      setClassSplitResult(dispatch, initialState.classSplitResult);
    }
    if (initialState?.laneAssignments) {
      updateLaneAssignments(dispatch, initialState.laneAssignments);
    }
    if (initialState?.classOrderPreferences) {
      updateClassOrderPreferences(dispatch, initialState.classOrderPreferences);
    }
    if (initialState?.classAssignments) {
      updateClassAssignments(
        dispatch,
        initialState.classAssignments,
        initialState.classOrderSeed,
        initialState.classOrderWarnings,
      );
    }
    if (initialState?.startOrderRules) {
      setStartOrderRules(dispatch, initialState.startOrderRules);
    }
    if (initialState?.worldRankingEntriesByClass) {
      for (const [classId, entries] of Object.entries(initialState.worldRankingEntriesByClass)) {
        updateClassWorldRanking(dispatch, classId, new Map(entries));
      }
    }
    if (initialState?.startTimes) {
      updateStartTimes(dispatch, initialState.startTimes);
    }
    if (initialState?.snapshot !== undefined) {
      updateSnapshot(dispatch, initialState.snapshot);
    }
    if (initialState?.versionHistory) {
      updateVersionHistory(dispatch, initialState.versionHistory);
    }
    if (initialState?.diff !== undefined) {
      updateDiff(dispatch, initialState.diff);
    }
    if (initialState?.statuses) {
      for (const [key, status] of Object.entries(initialState.statuses) as [StatusKey, StatusMessageState][]) {
        setStatus(dispatch, key, status);
      }
    }
    if (initialState?.loading) {
      for (const [key, value] of Object.entries(initialState.loading) as [StatusKey, boolean][]) {
        setLoading(dispatch, key, value);
      }
    }
  }, [dispatch, initialState]);

  useEffect(() => {
    if (initialState?.editingEntryId !== undefined) {
      setEditingEntryId(initialState.editingEntryId);
    }
  }, [initialState, setEditingEntryId]);

  useEffect(() => {
    initialize?.(dispatch);
  }, [dispatch, initialize]);

  return <>{children}</>;
};

const Wrapper = ({ children, initialize, initialState }: PropsWithChildren<WrapperProps>) => {
  return (
    <StartlistProvider>
      <Initializer initialize={initialize} initialState={initialState}>
        {children}
      </Initializer>
    </StartlistProvider>
  );
};

interface RenderWithStartlistOptions extends Omit<RenderOptions, 'wrapper'>, WrapperProps {}

export const renderWithStartlist = (
  ui: ReactElement,
  { initialize, initialState, ...options }: RenderWithStartlistOptions = {},
) => {
  return render(ui, {
    wrapper: ({ children }) => (
      <Wrapper initialize={initialize} initialState={initialState}>
        {children}
      </Wrapper>
    ),
    ...options,
  });
};

export const createSuccessStatus = (message: string): StatusMessageState => createStatus(message, 'success');

interface RenderWithRouterOptions extends RenderWithStartlistOptions {
  routerProps?: MemoryRouterProps;
}

export const renderWithStartlistRouter = (
  ui: ReactElement,
  { routerProps, ...options }: RenderWithRouterOptions = {},
) => {
  return renderWithStartlist(<MemoryRouter {...routerProps}>{ui}</MemoryRouter>, options);
};

interface WorldRankingInitialStateOptions {
  csvName?: string;
  entries?: [string, number][];
  ruleId?: string;
}

export const createWorldRankingInitialState = (
  classId: string,
  { csvName = 'world-ranking.csv', entries, ruleId }: WorldRankingInitialStateOptions = {},
): StartlistTestInitialState => {
  const initial: StartlistTestInitialState = {
    startOrderRules: [
      { id: ruleId ?? `world-ranking-${classId}`, classId, method: 'worldRanking', csvName },
    ],
  };
  if (entries) {
    initial.worldRankingEntriesByClass = {
      [classId]: entries,
    };
  }
  return initial;
};
