import { useCallback } from 'react';
import type {
  AssignLaneOrderCommand,
  AssignPlayerOrderCommand,
  AssignStartTimesCommand,
  EnterStartlistSettingsCommand,
  FinalizeStartlistCommand,
  GetStartlistQuery,
  InvalidateStartTimesCommand,
  ManuallyFinalizeClassStartOrderCommand,
  ManuallyReassignLaneOrderCommand,
} from '@startlist-management/application';

export interface StartlistSnapshot {
  settings?: unknown;
  laneAssignments?: unknown;
  classAssignments?: unknown;
  startTimes?: unknown;
  [key: string]: unknown;
}

const ensureOk = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `リクエストに失敗しました (status: ${response.status})`);
  }
  if (response.status === 204) {
    return undefined;
  }
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

export const useStartlistApi = () => {
  const basePath = '/api/startlists';

  const post = useCallback(async (path: string, body?: unknown) => {
    const init: RequestInit = {
      method: 'POST',
    };
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const response = await fetch(path, init);
    return ensureOk(response);
  }, []);

  const get = useCallback(async (path: string) => {
    const response = await fetch(path);
    return ensureOk(response);
  }, []);

  const enterSettings = useCallback(
    async (command: EnterStartlistSettingsCommand): Promise<StartlistSnapshot> => {
      return post(`${basePath}/${encodeURIComponent(command.startlistId)}/settings`, command.settings) as Promise<StartlistSnapshot>;
    },
    [post, basePath],
  );

  const fetchSnapshot = useCallback(
    async (query: GetStartlistQuery): Promise<StartlistSnapshot> => {
      return get(`${basePath}/${encodeURIComponent(query.startlistId)}`) as Promise<StartlistSnapshot>;
    },
    [get, basePath],
  );

  const assignLaneOrder = useCallback(
    async (command: AssignLaneOrderCommand | ManuallyReassignLaneOrderCommand): Promise<StartlistSnapshot | undefined> => {
      const payload: Record<string, unknown> = { assignments: command.assignments };
      if ('reason' in command && command.reason) {
        payload.reason = command.reason;
      }
      return post(`${basePath}/${encodeURIComponent(command.startlistId)}/lane-order`, payload) as Promise<StartlistSnapshot | undefined>;
    },
    [post, basePath],
  );

  const assignPlayerOrder = useCallback(
    async (
      command: AssignPlayerOrderCommand | ManuallyFinalizeClassStartOrderCommand,
    ): Promise<StartlistSnapshot | undefined> => {
      const payload: Record<string, unknown> = { assignments: command.assignments };
      if ('reason' in command && command.reason) {
        payload.reason = command.reason;
      }
      return post(`${basePath}/${encodeURIComponent(command.startlistId)}/player-order`, payload) as Promise<StartlistSnapshot | undefined>;
    },
    [post, basePath],
  );

  const assignStartTimes = useCallback(
    async (command: AssignStartTimesCommand): Promise<StartlistSnapshot | undefined> => {
      return post(`${basePath}/${encodeURIComponent(command.startlistId)}/start-times`, {
        startTimes: command.startTimes,
      }) as Promise<StartlistSnapshot | undefined>;
    },
    [post, basePath],
  );

  const finalize = useCallback(
    async (command: FinalizeStartlistCommand): Promise<StartlistSnapshot | undefined> => {
      return post(`${basePath}/${encodeURIComponent(command.startlistId)}/finalize`) as Promise<StartlistSnapshot | undefined>;
    },
    [post, basePath],
  );

  const invalidateStartTimes = useCallback(
    async (command: InvalidateStartTimesCommand): Promise<StartlistSnapshot | undefined> => {
      return post(`${basePath}/${encodeURIComponent(command.startlistId)}/start-times/invalidate`, {
        reason: command.reason,
      }) as Promise<StartlistSnapshot | undefined>;
    },
    [post, basePath],
  );

  return {
    enterSettings,
    fetchSnapshot,
    assignLaneOrder,
    assignPlayerOrder,
    assignStartTimes,
    finalize,
    invalidateStartTimes,
  };
};
