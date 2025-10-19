import { useCallback } from 'react';
import { resolveApiEndpoint } from '../../../config/api';
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
import type { StartlistSnapshot } from '@startlist-management/domain';

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
  const basePath = resolveApiEndpoint('startlist');

  const withBasePath = useCallback(
    (path: string) => {
      if (!path) {
        return basePath;
      }
      if (/^https?:/i.test(path)) {
        return path;
      }
      return `${basePath}${path.startsWith('/') ? '' : '/'}${path}`;
    },
    [basePath],
  );

  const post = useCallback(async (path: string, body?: unknown) => {
    const init: RequestInit = {
      method: 'POST',
    };
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const response = await fetch(withBasePath(path), init);
    return ensureOk(response);
  }, [withBasePath]);

  const get = useCallback(async (path: string) => {
    const response = await fetch(withBasePath(path));
    return ensureOk(response);
  }, [withBasePath]);

  const enterSettings = useCallback(
    async (command: EnterStartlistSettingsCommand): Promise<StartlistSnapshot> => {
      const response = (await post(
        `/${encodeURIComponent(command.startlistId)}/settings`,
        command.settings,
      )) as StartlistSnapshot;
      return response;
    },
    [post],
  );

  const fetchSnapshot = useCallback(
    async (query: GetStartlistQuery): Promise<StartlistSnapshot> => {
      const snapshot = (await get(`/${encodeURIComponent(query.startlistId)}`)) as StartlistSnapshot;
      return snapshot;
    },
    [get],
  );

  const assignLaneOrder = useCallback(
    async (command: AssignLaneOrderCommand | ManuallyReassignLaneOrderCommand): Promise<StartlistSnapshot | undefined> => {
      const payload: Record<string, unknown> = { assignments: command.assignments };
      if ('reason' in command && command.reason) {
        payload.reason = command.reason;
      }
      const response = (await post(
        `/${encodeURIComponent(command.startlistId)}/lane-order`,
        payload,
      )) as StartlistSnapshot | undefined;
      return response;
    },
    [post],
  );

  const assignPlayerOrder = useCallback(
    async (
      command: AssignPlayerOrderCommand | ManuallyFinalizeClassStartOrderCommand,
    ): Promise<StartlistSnapshot | undefined> => {
      const payload: Record<string, unknown> = { assignments: command.assignments };
      if ('reason' in command && command.reason) {
        payload.reason = command.reason;
      }
      const response = (await post(
        `/${encodeURIComponent(command.startlistId)}/player-order`,
        payload,
      )) as StartlistSnapshot | undefined;
      return response;
    },
    [post],
  );

  const assignStartTimes = useCallback(
    async (command: AssignStartTimesCommand): Promise<StartlistSnapshot | undefined> => {
      const response = (await post(`/${encodeURIComponent(command.startlistId)}/start-times`, {
        startTimes: command.startTimes,
      })) as StartlistSnapshot | undefined;
      return response;
    },
    [post],
  );

  const finalize = useCallback(
    async (command: FinalizeStartlistCommand): Promise<StartlistSnapshot | undefined> => {
      const response = (await post(
        `/${encodeURIComponent(command.startlistId)}/finalize`,
      )) as StartlistSnapshot | undefined;
      return response;
    },
    [post],
  );

  const invalidateStartTimes = useCallback(
    async (command: InvalidateStartTimesCommand): Promise<StartlistSnapshot | undefined> => {
      const response = (await post(
        `/${encodeURIComponent(command.startlistId)}/start-times/invalidate`,
        {
          reason: command.reason,
        },
      )) as StartlistSnapshot | undefined;
      return response;
    },
    [post],
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
