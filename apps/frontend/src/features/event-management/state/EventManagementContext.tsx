import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type {
  AttachStartlistCommand,
  CreateEventCommand,
  EventDto,
  ScheduleRaceCommand,
} from '@event-management/application';

import { useEventManagementApi } from '../api/useEventManagementApi';

interface EventManagementState {
  events: EventDto[];
  selectedEventId: string | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
}

interface EventManagementActions {
  refreshEvents: () => Promise<EventDto[]>;
  selectEvent: (eventId: string | null) => Promise<EventDto | null>;
  createEvent: (command: CreateEventCommand) => Promise<EventDto>;
  scheduleRace: (command: ScheduleRaceCommand) => Promise<EventDto>;
  attachStartlist: (command: AttachStartlistCommand) => Promise<EventDto>;
}

interface EventManagementContextValue {
  state: EventManagementState;
  actions: EventManagementActions;
}

const EventManagementContext = createContext<EventManagementContextValue | undefined>(undefined);

const ensureErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

export const EventManagementProvider = ({ children }: PropsWithChildren) => {
  const existingContext = useContext(EventManagementContext);
  if (existingContext) {
    return <>{children}</>;
  }

  const {
    listEvents,
    getEvent,
    createEvent: createEventApi,
    scheduleRace: scheduleRaceApi,
    attachStartlist: attachStartlistApi,
  } = useEventManagementApi();

  const [events, setEvents] = useState<EventDto[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsertEvent = useCallback((nextEvent: EventDto) => {
    setEvents((current) => {
      const index = current.findIndex((event) => event.id === nextEvent.id);
      if (index === -1) {
        return [...current, nextEvent];
      }
      const updated = current.slice();
      updated[index] = nextEvent;
      return updated;
    });
  }, []);

  const refreshEvents = useCallback(async (): Promise<EventDto[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await listEvents();
      setEvents(fetched);
      setSelectedEventId((current) => {
        if (!current) {
          return current;
        }
        return fetched.some((event) => event.id === current) ? current : null;
      });
      return fetched;
    } catch (refreshError) {
      const message = ensureErrorMessage(refreshError);
      setError(message);
      throw refreshError;
    } finally {
      setIsLoading(false);
    }
  }, [listEvents]);

  const selectEvent = useCallback(
    async (eventId: string | null): Promise<EventDto | null> => {
      if (eventId === null) {
        setSelectedEventId(null);
        return null;
      }

      setIsLoading(true);
      setError(null);
      try {
        const event = await getEvent(eventId);
        upsertEvent(event);
        setSelectedEventId(event.id);
        return event;
      } catch (selectError) {
        const message = ensureErrorMessage(selectError);
        setError(message);
        throw selectError;
      } finally {
        setIsLoading(false);
      }
    },
    [getEvent, upsertEvent],
  );

  const createEvent = useCallback(
    async (command: CreateEventCommand): Promise<EventDto> => {
      setIsMutating(true);
      setError(null);
      try {
        const event = await createEventApi(command);
        upsertEvent(event);
        setSelectedEventId(event.id);
        return event;
      } catch (createError) {
        const message = ensureErrorMessage(createError);
        setError(message);
        throw createError;
      } finally {
        setIsMutating(false);
      }
    },
    [createEventApi, upsertEvent],
  );

  const scheduleRace = useCallback(
    async (command: ScheduleRaceCommand): Promise<EventDto> => {
      setIsMutating(true);
      setError(null);
      try {
        const event = await scheduleRaceApi(command);
        upsertEvent(event);
        return event;
      } catch (scheduleError) {
        const message = ensureErrorMessage(scheduleError);
        setError(message);
        throw scheduleError;
      } finally {
        setIsMutating(false);
      }
    },
    [scheduleRaceApi, upsertEvent],
  );

  const attachStartlist = useCallback(
    async (command: AttachStartlistCommand): Promise<EventDto> => {
      setIsMutating(true);
      setError(null);
      try {
        const event = await attachStartlistApi(command);
        upsertEvent(event);
        return event;
      } catch (attachError) {
        const message = ensureErrorMessage(attachError);
        setError(message);
        throw attachError;
      } finally {
        setIsMutating(false);
      }
    },
    [attachStartlistApi, upsertEvent],
  );

  const contextValue = useMemo<EventManagementContextValue>(() => {
    return {
      state: {
        events,
        selectedEventId,
        isLoading,
        isMutating,
        error,
      },
      actions: {
        refreshEvents,
        selectEvent,
        createEvent,
        scheduleRace,
        attachStartlist,
      },
    };
  }, [events, selectedEventId, isLoading, isMutating, error, refreshEvents, selectEvent, createEvent, scheduleRace, attachStartlist]);

  return <EventManagementContext.Provider value={contextValue}>{children}</EventManagementContext.Provider>;
};

const useEventManagementContext = (): EventManagementContextValue => {
  const context = useContext(EventManagementContext);
  if (!context) {
    throw new Error('EventManagementProvider の外部で EventManagementContext を利用することはできません。');
  }
  return context;
};

export const useEventManagementState = (): EventManagementState => useEventManagementContext().state;

export const useEventManagementActions = (): EventManagementActions => useEventManagementContext().actions;

export const useEventManagement = () => {
  const { state, actions } = useEventManagementContext();
  const selectedEvent = useMemo(() => {
    if (!state.selectedEventId) {
      return null;
    }
    return state.events.find((event) => event.id === state.selectedEventId) ?? null;
  }, [state.events, state.selectedEventId]);

  return {
    events: state.events,
    selectedEventId: state.selectedEventId,
    selectedEvent,
    isLoading: state.isLoading,
    isMutating: state.isMutating,
    error: state.error,
    refreshEvents: actions.refreshEvents,
    selectEvent: actions.selectEvent,
    createEvent: actions.createEvent,
    scheduleRace: actions.scheduleRace,
    attachStartlist: actions.attachStartlist,
  };
};
