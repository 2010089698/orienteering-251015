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

type DurationLike = { milliseconds: number };
type StartlistSettingsCommandInput = EnterStartlistSettingsCommand['settings'] & { interval?: DurationLike };

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isDurationLike = (value: unknown): value is DurationLike => {
  return isRecord(value) && typeof value.milliseconds === 'number';
};

const cloneDuration = (duration: DurationLike): DurationLike => ({ milliseconds: duration.milliseconds });

const resolveDuration = (primary: unknown, fallback: unknown): DurationLike | undefined => {
  if (isDurationLike(primary)) {
    return cloneDuration(primary);
  }
  if (isDurationLike(fallback)) {
    return cloneDuration(fallback);
  }
  return undefined;
};

const normalizeSettingsPayload = (
  settings: StartlistSettingsCommandInput,
): EnterStartlistSettingsCommand['settings'] => {
  const laneClassInterval = resolveDuration(settings.laneClassInterval, settings.interval);
  const classPlayerInterval = resolveDuration(settings.classPlayerInterval, settings.interval);
  if (!laneClassInterval || !classPlayerInterval) {
    throw new Error('Both laneClassInterval and classPlayerInterval must be provided.');
  }

  const startTime =
    settings.startTime instanceof Date ? settings.startTime.toISOString() : settings.startTime;

  return {
    eventId: settings.eventId,
    startTime,
    laneClassInterval,
    classPlayerInterval,
    laneCount: settings.laneCount,
  };
};

const normalizeSettingsResponse = (settings: unknown): unknown => {
  if (!isRecord(settings)) {
    return settings;
  }
  const laneClassInterval = resolveDuration(settings.laneClassInterval, settings.interval);
  const classPlayerInterval = resolveDuration(settings.classPlayerInterval, settings.interval);

  if (!laneClassInterval && !classPlayerInterval) {
    return settings;
  }

  return {
    ...settings,
    ...(laneClassInterval ? { laneClassInterval } : {}),
    ...(classPlayerInterval ? { classPlayerInterval } : {}),
  };
};

const normalizeSnapshot = (snapshot: StartlistSnapshot | undefined): StartlistSnapshot | undefined => {
  if (!snapshot) {
    return snapshot;
  }
  const normalizedSettings = normalizeSettingsResponse(snapshot.settings);
  if (normalizedSettings !== snapshot.settings) {
    return { ...snapshot, settings: normalizedSettings };
  }
  return snapshot;
};

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
      const payload = normalizeSettingsPayload(command.settings as StartlistSettingsCommandInput);
      const response = (await post(
        `${basePath}/${encodeURIComponent(command.startlistId)}/settings`,
        payload,
      )) as StartlistSnapshot;
      return normalizeSnapshot(response) as StartlistSnapshot;
    },
    [post, basePath],
  );

  const fetchSnapshot = useCallback(
    async (query: GetStartlistQuery): Promise<StartlistSnapshot> => {
      const snapshot = (await get(
        `${basePath}/${encodeURIComponent(query.startlistId)}`,
      )) as StartlistSnapshot;
      return normalizeSnapshot(snapshot) as StartlistSnapshot;
    },
    [get, basePath],
  );

  const assignLaneOrder = useCallback(
    async (command: AssignLaneOrderCommand | ManuallyReassignLaneOrderCommand): Promise<StartlistSnapshot | undefined> => {
      const payload: Record<string, unknown> = { assignments: command.assignments };
      if ('reason' in command && command.reason) {
        payload.reason = command.reason;
      }
      const response = (await post(
        `${basePath}/${encodeURIComponent(command.startlistId)}/lane-order`,
        payload,
      )) as StartlistSnapshot | undefined;
      return normalizeSnapshot(response);
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
      const response = (await post(
        `${basePath}/${encodeURIComponent(command.startlistId)}/player-order`,
        payload,
      )) as StartlistSnapshot | undefined;
      return normalizeSnapshot(response);
    },
    [post, basePath],
  );

  const assignStartTimes = useCallback(
    async (command: AssignStartTimesCommand): Promise<StartlistSnapshot | undefined> => {
      const response = (await post(`${basePath}/${encodeURIComponent(command.startlistId)}/start-times`, {
        startTimes: command.startTimes,
      })) as StartlistSnapshot | undefined;
      return normalizeSnapshot(response);
    },
    [post, basePath],
  );

  const finalize = useCallback(
    async (command: FinalizeStartlistCommand): Promise<StartlistSnapshot | undefined> => {
      const response = (await post(
        `${basePath}/${encodeURIComponent(command.startlistId)}/finalize`,
      )) as StartlistSnapshot | undefined;
      return normalizeSnapshot(response);
    },
    [post, basePath],
  );

  const invalidateStartTimes = useCallback(
    async (command: InvalidateStartTimesCommand): Promise<StartlistSnapshot | undefined> => {
      const response = (await post(
        `${basePath}/${encodeURIComponent(command.startlistId)}/start-times/invalidate`,
        {
          reason: command.reason,
        },
      )) as StartlistSnapshot | undefined;
      return normalizeSnapshot(response);
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
