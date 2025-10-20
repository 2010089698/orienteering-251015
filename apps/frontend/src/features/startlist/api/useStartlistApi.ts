import { useCallback } from 'react';
import { resolveApiEndpoint } from '../../../config/api';
import type {
  AssignLaneOrderCommand,
  AssignPlayerOrderCommand,
  AssignStartTimesCommand,
  EnterStartlistSettingsCommand,
  FinalizeStartlistCommand,
  GetStartlistQuery,
  GetStartlistVersionsQuery,
  GetStartlistVersionsResult,
  GetStartlistDiffQuery,
  InvalidateStartTimesCommand,
  ManuallyFinalizeClassStartOrderCommand,
  ManuallyReassignLaneOrderCommand,
  StartlistDiffDto,
  StartlistWithHistoryDto,
} from '@startlist-management/application';

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
    async (command: EnterStartlistSettingsCommand): Promise<StartlistWithHistoryDto> => {
      const response = (await post(
        `/${encodeURIComponent(command.startlistId)}/settings`,
        command.settings,
      )) as StartlistWithHistoryDto;
      return response;
    },
    [post],
  );

  const fetchSnapshot = useCallback(
    async (query: GetStartlistQuery): Promise<StartlistWithHistoryDto> => {
      const searchParams = new URLSearchParams();
      if (query.includeVersions) {
        searchParams.set('includeVersions', 'true');
      }
      if (query.versionLimit) {
        searchParams.set('versionLimit', String(query.versionLimit));
      }
      if (query.includeDiff) {
        searchParams.set('includeDiff', 'true');
      }
      if (query.diffFromVersion) {
        searchParams.set('diffFromVersion', String(query.diffFromVersion));
      }
      if (query.diffToVersion) {
        searchParams.set('diffToVersion', String(query.diffToVersion));
      }
      const queryString = searchParams.toString();
      const path = `/${encodeURIComponent(query.startlistId)}${queryString ? `?${queryString}` : ''}`;
      const snapshot = (await get(path)) as StartlistWithHistoryDto;
      return snapshot;
    },
    [get],
  );

  const assignLaneOrder = useCallback(
    async (
      command: AssignLaneOrderCommand | ManuallyReassignLaneOrderCommand,
    ): Promise<StartlistWithHistoryDto | undefined> => {
      const payload: Record<string, unknown> = { assignments: command.assignments };
      if ('reason' in command && command.reason) {
        payload.reason = command.reason;
      }
      const response = (await post(
        `/${encodeURIComponent(command.startlistId)}/lane-order`,
        payload,
      )) as StartlistWithHistoryDto | undefined;
      return response;
    },
    [post],
  );

  const assignPlayerOrder = useCallback(
    async (
      command: AssignPlayerOrderCommand | ManuallyFinalizeClassStartOrderCommand,
    ): Promise<StartlistWithHistoryDto | undefined> => {
      const payload: Record<string, unknown> = { assignments: command.assignments };
      if ('reason' in command && command.reason) {
        payload.reason = command.reason;
      }
      const response = (await post(
        `/${encodeURIComponent(command.startlistId)}/player-order`,
        payload,
      )) as StartlistWithHistoryDto | undefined;
      return response;
    },
    [post],
  );

  const assignStartTimes = useCallback(
    async (command: AssignStartTimesCommand): Promise<StartlistWithHistoryDto | undefined> => {
      const response = (await post(`/${encodeURIComponent(command.startlistId)}/start-times`, {
        startTimes: command.startTimes,
      })) as StartlistWithHistoryDto | undefined;
      return response;
    },
    [post],
  );

  const finalize = useCallback(
    async (command: FinalizeStartlistCommand): Promise<StartlistWithHistoryDto | undefined> => {
      const response = (await post(
        `/${encodeURIComponent(command.startlistId)}/finalize`,
      )) as StartlistWithHistoryDto | undefined;
      return response;
    },
    [post],
  );

  const invalidateStartTimes = useCallback(
    async (command: InvalidateStartTimesCommand): Promise<StartlistWithHistoryDto | undefined> => {
      const response = (await post(
        `/${encodeURIComponent(command.startlistId)}/start-times/invalidate`,
        {
          reason: command.reason,
        },
      )) as StartlistWithHistoryDto | undefined;
      return response;
    },
    [post],
  );

  const fetchVersions = useCallback(
    async (query: GetStartlistVersionsQuery): Promise<GetStartlistVersionsResult> => {
      const searchParams = new URLSearchParams();
      if (query.limit) {
        searchParams.set('limit', String(query.limit));
      }
      if (query.offset) {
        searchParams.set('offset', String(query.offset));
      }
      const path = `/${encodeURIComponent(query.startlistId)}/versions${
        searchParams.size ? `?${searchParams.toString()}` : ''
      }`;
      const response = (await get(path)) as GetStartlistVersionsResult;
      return response;
    },
    [get],
  );

  const fetchDiff = useCallback(
    async (query: GetStartlistDiffQuery): Promise<StartlistDiffDto> => {
      const searchParams = new URLSearchParams();
      if (query.fromVersion) {
        searchParams.set('fromVersion', String(query.fromVersion));
      }
      if (query.toVersion) {
        searchParams.set('toVersion', String(query.toVersion));
      }
      const path = `/${encodeURIComponent(query.startlistId)}/diff${
        searchParams.size ? `?${searchParams.toString()}` : ''
      }`;
      const response = (await get(path)) as StartlistDiffDto;
      return response;
    },
    [get],
  );

  return {
    enterSettings,
    fetchSnapshot,
    assignLaneOrder,
    assignPlayerOrder,
    assignStartTimes,
    finalize,
    invalidateStartTimes,
    fetchVersions,
    fetchDiff,
  };
};
