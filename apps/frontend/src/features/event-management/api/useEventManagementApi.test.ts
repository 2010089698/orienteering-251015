import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEventManagementApi } from './useEventManagementApi';

const originalFetch = global.fetch;

let fetchMock: ReturnType<typeof vi.fn>;

const createJsonResponse = (data: unknown, init: ResponseInit = {}) => {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
};

describe('useEventManagementApi', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it('fetches the event collection from the base endpoint', async () => {
    const { result } = renderHook(() => useEventManagementApi());
    const events = [
      {
        id: 'ev-1',
        name: 'Sample',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        venue: 'Tokyo',
        races: [],
      },
    ];
    fetchMock.mockResolvedValue(createJsonResponse({ events }));

    const response = await result.current.listEvents();

    expect(fetchMock).toHaveBeenCalledWith('/api/events');
    expect(response).toEqual(events);
  });

  it('requests a single event by encoding the identifier in the URL', async () => {
    const { result } = renderHook(() => useEventManagementApi());
    const event = {
      id: 'ev/特殊',
      name: 'Encoded',
      startDate: '2024-03-01',
      endDate: '2024-03-02',
      venue: 'Osaka',
      races: [],
    };
    fetchMock.mockResolvedValue(createJsonResponse({ event }));

    const response = await result.current.getEvent('ev/特殊');

    expect(fetchMock).toHaveBeenCalledWith('/api/events/ev%2F%E7%89%B9%E6%AE%8A');
    expect(response).toEqual(event);
  });

  it('posts new event commands to the base endpoint and returns the created entity', async () => {
    const { result } = renderHook(() => useEventManagementApi());
    const command = {
      name: 'Spring Open',
      startDate: '2024-04-01T09:00:00.000Z',
      endDate: '2024-04-01T17:00:00.000Z',
      venue: 'Nagoya',
    };
    const event = { ...command, id: 'EV-2', races: [] };
    fetchMock.mockResolvedValue(createJsonResponse({ event }));

    const response = await result.current.createEvent(command);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify(command));
    expect(response).toEqual(event);
  });

  it('submits race scheduling payloads to the race endpoint and extracts startlist metadata', async () => {
    const { result } = renderHook(() => useEventManagementApi());
    const event = {
      id: 'EV-3',
      name: 'Night Sprint',
      startDate: '2024-05-01',
      endDate: '2024-05-02',
      venue: 'Kyoto',
      races: [
        {
          id: 'race-1',
          name: 'Qualifier',
          schedule: { start: '2024-05-01T10:00:00.000Z', end: undefined },
          duplicateDay: false,
          overlapsExisting: false,
        },
        {
          id: 'race-2',
          name: 'Final',
          schedule: { start: '2024-05-02T00:00:00.000Z', end: undefined },
          duplicateDay: false,
          overlapsExisting: false,
          startlist: { id: 'SL-99', status: 'DRAFT' },
        },
      ],
    };
    fetchMock.mockResolvedValue(createJsonResponse({ event }));

    const response = await result.current.scheduleRace({
      eventId: 'EV-3',
      name: 'Final',
      date: '2024-05-02',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events/EV-3/races',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Final',
      date: '2024-05-02',
    });
    expect(response.event).toEqual(event);
    expect(response.startlist).toEqual({
      raceId: 'race-2',
      raceName: 'Final',
      startlistId: 'SL-99',
      status: 'DRAFT',
    });
  });

  it('attaches finalized startlists to races via the dedicated endpoint', async () => {
    const { result } = renderHook(() => useEventManagementApi());
    const event = {
      id: 'EV-4',
      name: 'Relay',
      startDate: '2024-07-01',
      endDate: '2024-07-02',
      venue: 'Sapporo',
      races: [
        {
          id: 'race-5',
          name: 'Relay Final',
          schedule: { start: '2024-07-01T12:00:00.000Z', end: undefined },
          duplicateDay: false,
          overlapsExisting: false,
          startlist: {
            id: 'SL-200',
            status: 'FINALIZED',
            confirmedAt: '2024-07-01T15:00:00.000Z',
            publicVersion: 4,
            publicUrl: 'https://public/startlists/SL-200',
          },
        },
      ],
    };

    fetchMock.mockResolvedValue(createJsonResponse({ event }));

    const response = await result.current.attachStartlist({
      eventId: 'EV-4',
      raceId: 'race-5',
      startlistId: 'SL-200',
      confirmedAt: '2024-07-01T15:00:00.000Z',
      version: 4,
      publicUrl: 'https://public/startlists/SL-200',
      status: 'FINALIZED',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events/EV-4/races/race-5/startlist',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    expect(JSON.parse(init?.body as string)).toEqual({
      startlistId: 'SL-200',
      confirmedAt: '2024-07-01T15:00:00.000Z',
      version: 4,
      publicUrl: 'https://public/startlists/SL-200',
      status: 'FINALIZED',
    });
    expect(response).toEqual(event);
  });

  it('throws with the response text when the request fails', async () => {
    const { result } = renderHook(() => useEventManagementApi());
    fetchMock.mockResolvedValue(new Response('失敗しました', { status: 500 }));

    await expect(result.current.listEvents()).rejects.toThrow('失敗しました');
  });
});
