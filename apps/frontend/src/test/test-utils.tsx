import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { PropsWithChildren, useEffect, type Dispatch } from 'react';
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
} from '../state/StartlistContext';
import type { StartlistSettingsDto, LaneAssignmentDto, ClassAssignmentDto, StartTimeDto } from '@startlist-management/application';
import type { Entry, StatusKey, StatusMessageState } from '../state/types';

interface InitialStateOverrides {
  startlistId?: string;
  settings?: StartlistSettingsDto;
  entries?: Entry[];
  laneAssignments?: LaneAssignmentDto[];
  classAssignments?: ClassAssignmentDto[];
  startTimes?: StartTimeDto[];
  snapshot?: unknown;
  statuses?: Partial<Record<StatusKey, StatusMessageState>>;
  loading?: Partial<Record<StatusKey, boolean>>;
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
    if (initialState?.laneAssignments) {
      updateLaneAssignments(dispatch, initialState.laneAssignments);
    }
    if (initialState?.classAssignments) {
      updateClassAssignments(dispatch, initialState.classAssignments);
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
