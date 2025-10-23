import { useCallback } from 'react';
import { resolveApiEndpoint } from '../../../config/api';
import type {
  AttachStartlistCommand,
  CreateEventCommand,
  EventDto,
  ScheduleRaceCommand,
} from '@event-management/application';

interface EventResponse {
  event: EventDto;
}

interface EventListResponse {
  events: EventDto[];
}

interface AttachStartlistResponse {
  event: EventDto;
  startlistId: string;
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
    async (command: ScheduleRaceCommand): Promise<EventDto> => {
      const { eventId, name, date } = command;
      const { event } = (await postJson(`/${encodeURIComponent(eventId)}/races`, { name, date })) as EventResponse;
      return event;
    },
    [postJson],
  );

  const attachStartlist = useCallback(
    async (command: AttachStartlistCommand): Promise<AttachStartlistResponse> => {
      const { eventId, raceId, ...payload } = command;
      const { event, startlistId } = (await postJson(
        `/${encodeURIComponent(eventId)}/races/${encodeURIComponent(raceId)}/startlist`,
        payload,
      )) as AttachStartlistResponse;
      return { event, startlistId };
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
