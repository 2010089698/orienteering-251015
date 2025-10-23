import { useCallback } from 'react';
import { resolveApiEndpoint } from '../../../config/api';
import type {
  CreateEventCommand,
  EventDto,
  RaceDto,
  ScheduleRaceCommand,
} from '@event-management/application';

interface EventResponse {
  event: EventDto;
}

interface EventListResponse {
  events: EventDto[];
}

export interface ScheduledRaceStartlist {
  raceId: string;
  raceName: string;
  startlistId: string;
  status: string;
}

export interface ScheduleRaceResult {
  event: EventDto;
  startlist?: ScheduledRaceStartlist;
}

export interface AttachStartlistCommand {
  eventId: string;
  raceId: string;
  startlistId: string;
  confirmedAt: string;
  version: number;
  publicUrl: string;
  status?: string;
}

const toIsoString = (value?: string): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed.toISOString();
};

const extractScheduledRaceStartlist = (
  event: EventDto,
  command: ScheduleRaceCommand,
): ScheduledRaceStartlist | undefined => {
  const targetStart = toIsoString(command.date);
  const candidates = [...event.races].reverse();
  const matchingRace = candidates.find((race: RaceDto) => {
    if (!race.startlist) {
      return false;
    }
    if (race.name !== command.name) {
      return false;
    }
    if (!targetStart) {
      return true;
    }
    const raceStart = toIsoString(race.schedule.start);
    return raceStart === targetStart;
  });

  if (!matchingRace?.startlist) {
    return undefined;
  }

  const { id: raceId, name: raceName, startlist } = matchingRace;
  return {
    raceId,
    raceName,
    startlistId: startlist.id,
    status: startlist.status,
  };
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

export const useEventManagementApi = () => {
  const basePath = resolveApiEndpoint('eventManagement');

  const withBasePath = useCallback(
    (path = '') => {
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

  const get = useCallback(
    async (path = '') => {
      const response = await fetch(withBasePath(path));
      return ensureOk(response);
    },
    [withBasePath],
  );

  const postJson = useCallback(
    async (path: string, body?: unknown, init: RequestInit = {}) => {
      const response = await fetch(withBasePath(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        ...init,
      });
      return ensureOk(response);
    },
    [withBasePath],
  );

  const listEvents = useCallback(async (): Promise<EventDto[]> => {
    const { events } = (await get()) as EventListResponse;
    return events;
  }, [get]);

  const getEvent = useCallback(
    async (eventId: string): Promise<EventDto> => {
      const { event } = (await get(`/${encodeURIComponent(eventId)}`)) as EventResponse;
      return event;
    },
    [get],
  );

  const createEvent = useCallback(
    async (command: CreateEventCommand): Promise<EventDto> => {
      const { event } = (await postJson('', command)) as EventResponse;
      return event;
    },
    [postJson],
  );

  const scheduleRace = useCallback(
    async (command: ScheduleRaceCommand): Promise<ScheduleRaceResult> => {
      const { eventId, name, date } = command;
      const { event } = (await postJson(`/${encodeURIComponent(eventId)}/races`, { name, date })) as EventResponse;
      const startlist = extractScheduledRaceStartlist(event, command);
      return { event, startlist };
    },
    [postJson],
  );

  const attachStartlist = useCallback(
    async (command: AttachStartlistCommand): Promise<EventDto> => {
      const { eventId, raceId, startlistId, confirmedAt, version, publicUrl, status } = command;
      const body: Record<string, unknown> = {
        startlistId,
        confirmedAt,
        version,
        publicUrl,
      };
      if (status) {
        body.status = status;
      }
      const { event } = (await postJson(
        `/${encodeURIComponent(eventId)}/races/${encodeURIComponent(raceId)}/startlist`,
        body,
      )) as EventResponse;
      return event;
    },
    [postJson],
  );

  return {
    listEvents,
    getEvent,
    createEvent,
    scheduleRace,
    attachStartlist,
  };
};
