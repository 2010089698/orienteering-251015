import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { PropsWithChildren, useEffect, type Dispatch } from 'react';
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
} from '../state/StartlistContext';
import type {
  StartlistSettingsDto,
  LaneAssignmentDto,
  ClassAssignmentDto,
  StartTimeDto,
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
} from '../state/types';

interface InitialStateOverrides {
  startlistId?: string;
  settings?: StartlistSettingsDto;
  entries?: Entry[];
  laneAssignments?: LaneAssignmentDto[];
  classAssignments?: ClassAssignmentDto[];
  classOrderSeed?: string;
  classOrderWarnings?: ClassOrderWarning[];
  classOrderPreferences?: ClassOrderPreferences;
  startTimes?: StartTimeDto[];
  snapshot?: unknown;
  statuses?: Partial<Record<StatusKey, StatusMessageState>>;
  loading?: Partial<Record<StatusKey, boolean>>;
  startOrderRules?: StartOrderRules;
  worldRankingEntriesByClass?: Record<string, [string, number][]>;
  classSplitRules?: ClassSplitRule[];
  classSplitResult?: ClassSplitResult;
}

interface WrapperProps {
  initialize?: (dispatch: Dispatch<unknown>) => void;
  initialState?: InitialStateOverrides;
}

const Initializer = ({ children, initialize, initialState }: PropsWithChildren<WrapperProps>) => {
  const dispatch = useStartlistDispatch();

  useEffect(() => {
    if (initialState?.settings && initialState.startlistId) {
      updateSettings(dispatch, {
        startlistId: initialState.startlistId,
        settings: initialState.settings,
        snapshot: initialState.snapshot,
      });
    }
  }, [dispatch, initialState]);

  useEffect(() => {
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
