import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventId, RaceId, RaceSchedule } from '@event-management/domain';
import { HttpStartlistSyncPort } from '@event-management/infrastructure';
import { Startlist, StartlistId, SystemClock } from '@startlist-management/domain';
import { createStartlistModule } from '@startlist-management/infrastructure';
import { createServer, StartlistServer } from '../server.js';

const STARTLIST_ID = 'startlist-1';
type StartlistCreatePayload = {
  eventId: string;
  raceId: string;
  schedule: { start: string; end?: string };
  updatedAt?: string;
};
const SETTINGS_PAYLOAD = {
  eventId: 'event-1',
  startTime: '2024-01-01T10:00:00.000Z',
  intervals: {
    laneClass: { milliseconds: 600000 },
    classPlayer: { milliseconds: 300000 },
  },
  laneCount: 2,
};

const LANE_ASSIGNMENTS = [
  {
    laneNumber: 1,
    classOrder: ['class-1', 'class-2'],
    interval: { milliseconds: 600000 },
  },
  {
    laneNumber: 2,
    classOrder: ['class-3'],
    interval: { milliseconds: 600000 },
  },
];

const CLASS_ASSIGNMENTS = [
  {
    classId: 'class-1',
    playerOrder: ['player-1', 'player-2'],
    interval: { milliseconds: 600000 },
  },
  {
    classId: 'class-2',
    playerOrder: ['player-3'],
    interval: { milliseconds: 600000 },
  },
  {
    classId: 'class-3',
    playerOrder: ['player-4'],
    interval: { milliseconds: 600000 },
  },
];

const START_TIMES = [
  { playerId: 'player-1', startTime: '2024-01-01T10:00:00.000Z', laneNumber: 1 },
  { playerId: 'player-2', startTime: '2024-01-01T10:10:00.000Z', laneNumber: 1 },
  { playerId: 'player-3', startTime: '2024-01-01T10:20:00.000Z', laneNumber: 2 },
  { playerId: 'player-4', startTime: '2024-01-01T10:30:00.000Z', laneNumber: 2 },
];

describe('startlistRoutes', () => {
  let server: StartlistServer;
  let module: ReturnType<typeof createStartlistModule>;

  beforeEach(async () => {
    module = createStartlistModule();
    server = createServer({
      startlist: {
        useCases: module.useCases,
        queryService: module.queryService,
      },
    });
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  const enterSettings = async () => {
    return server.inject({
      method: 'POST',
      url: `/api/startlists/${STARTLIST_ID}/settings`,
      payload: SETTINGS_PAYLOAD,
    });
  };

  const createStartlist = async (overrides: Partial<StartlistCreatePayload> = {}) => {
    const payload = {
      eventId: SETTINGS_PAYLOAD.eventId,
      raceId: STARTLIST_ID,
      schedule: {
        start: '2024-01-01T08:00:00.000Z',
      },
      updatedAt: '2024-01-01T07:30:00.000Z',
      ...overrides,
    } as StartlistCreatePayload;
    return server.inject({ method: 'POST', url: '/api/startlists', payload });
  };

  const assignLaneOrder = async () => {
    return server.inject({
      method: 'POST',
      url: `/api/startlists/${STARTLIST_ID}/lane-order`,
      payload: { assignments: LANE_ASSIGNMENTS },
    });
  };

  const assignPlayerOrder = async () => {
    return server.inject({
      method: 'POST',
      url: `/api/startlists/${STARTLIST_ID}/player-order`,
      payload: { assignments: CLASS_ASSIGNMENTS },
    });
  };

  const assignStartTimes = async () => {
    return server.inject({
      method: 'POST',
      url: `/api/startlists/${STARTLIST_ID}/start-times`,
      payload: { startTimes: START_TIMES },
    });
  };

  it('accepts race schedule sync payloads from the EventManagement HTTP port', async () => {
    const syncSpy = vi.spyOn(module.useCases.createStartlistForRace, 'execute');

    const port = new HttpStartlistSyncPort({
      baseUrl: 'http://startlists.local',
      fetchImpl: async (input, init) => {
        const url = new URL(input);
        const response = await server.inject({
          method: init?.method ?? 'GET',
          url: `${url.pathname}${url.search}`,
          headers: init?.headers,
          payload: init?.body,
        });
        return {
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          text: async () => response.body ?? '',
        };
      },
    });

    const schedule = RaceSchedule.from(
      new Date('2024-05-01T10:00:00.000Z'),
      new Date('2024-05-01T11:30:00.000Z'),
    );
    const updatedAt = new Date('2024-04-30T12:00:00.000Z');

    await port.notifyRaceScheduled({
      eventId: EventId.from('event-sync'),
      raceId: RaceId.from('race-sync'),
      schedule,
      updatedAt,
    });

    expect(syncSpy).toHaveBeenCalledTimes(1);
    const call = syncSpy.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      startlistId: 'race-sync',
      eventId: 'event-sync',
      raceId: 'race-sync',
    });
    expect(call?.updatedAt?.toISOString()).toBe(updatedAt.toISOString());
    expect(call?.schedule?.start.toISOString()).toBe(schedule.getStart().toISOString());
    expect(call?.schedule?.end?.toISOString()).toBe(schedule.getEnd()?.toISOString());

    syncSpy.mockRestore();
  });

  it('responds to health checks', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('creates a startlist and returns the snapshot state', async () => {
    const createResponse = await createStartlist();
    expect(createResponse.statusCode).toBe(201);
    const createBody = createResponse.json();
    expect(createBody.startlistId).toBe(STARTLIST_ID);
    expect(createBody.created).toBe(true);
    expect(createBody.status).toBe(createBody.snapshot.status);
    expect(createBody.snapshot.eventId).toBe(SETTINGS_PAYLOAD.eventId);
    expect(createBody.snapshot.raceId).toBe(STARTLIST_ID);

    const settingsResponse = await enterSettings();
    expect(settingsResponse.statusCode).toBe(200);

    const laneOrderResponse = await assignLaneOrder();
    expect(laneOrderResponse.statusCode).toBe(200);

    const playerOrderResponse = await assignPlayerOrder();
    expect(playerOrderResponse.statusCode).toBe(200);

    const startTimesResponse = await assignStartTimes();
    expect(startTimesResponse.statusCode).toBe(200);

    const getResponse = await server.inject({
      method: 'GET',
      url: `/api/startlists/${STARTLIST_ID}`,
    });

    expect(getResponse.statusCode).toBe(200);
    const body = getResponse.json();
    expect(body.id).toBe(STARTLIST_ID);
    expect(body.eventId).toBe(SETTINGS_PAYLOAD.eventId);
    expect(body.raceId).toBe(STARTLIST_ID);
    expect(body.status).toBe('START_TIMES_ASSIGNED');
    expect(body.startTimes).toHaveLength(START_TIMES.length);
    expect(body.settings.eventId).toBe(SETTINGS_PAYLOAD.eventId);
    expect(body.settings.intervals.laneClass).toEqual(SETTINGS_PAYLOAD.intervals.laneClass);
    expect(body.settings.intervals.classPlayer).toEqual(SETTINGS_PAYLOAD.intervals.classPlayer);
    expect(body.versions).toBeUndefined();
    expect(body.diff).toBeUndefined();
  });

  it('returns the existing startlist when creation is repeated', async () => {
    await createStartlist();

    const secondResponse = await createStartlist({
      schedule: { start: '2024-01-02T08:00:00.000Z', end: '2024-01-02T09:00:00.000Z' },
      updatedAt: '2024-01-02T07:30:00.000Z',
    });

    expect(secondResponse.statusCode).toBe(200);
    const body = secondResponse.json();
    expect(body.created).toBe(false);
    expect(body.startlistId).toBe(STARTLIST_ID);
    expect(body.status).toBe(body.snapshot.status);
    expect(body.snapshot.eventId).toBe(SETTINGS_PAYLOAD.eventId);
    expect(body.snapshot.raceId).toBe(STARTLIST_ID);
  });

  it('accepts legacy interval payloads and returns the expanded structure', async () => {
    const response = await server.inject({
      method: 'POST',
      url: `/api/startlists/${STARTLIST_ID}/settings`,
      payload: {
        eventId: 'legacy-event',
        startTime: '2024-01-02T10:00:00.000Z',
        interval: { milliseconds: 600000 },
        laneCount: 3,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.settings.intervals.laneClass).toEqual({ milliseconds: 600000 });
    expect(body.settings.intervals.classPlayer).toEqual({ milliseconds: 600000 });
  });

  it('returns 404 when querying a missing startlist', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/startlists/missing-id',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.message).toContain('was not found');
  });

  it('returns version summaries and diff when requested explicitly', async () => {
    await enterSettings();
    await assignLaneOrder();
    await assignPlayerOrder();
    await assignStartTimes();
    const finalizeResponse = await server.inject({
      method: 'POST',
      url: `/api/startlists/${STARTLIST_ID}/finalize`,
    });
    expect(finalizeResponse.statusCode).toBe(200);

    const response = await server.inject({
      method: 'GET',
      url: `/api/startlists/${STARTLIST_ID}?includeVersions=true&includeDiff=true`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.versions).toBeDefined();
    expect(body.versions[0].version).toBeGreaterThan(0);
    expect(body.diff?.to.version).toBeGreaterThan(0);
  });

  it('maps domain validation errors to HTTP 400', async () => {
    const settingsResponse = await enterSettings();
    expect(settingsResponse.statusCode).toBe(200);

    const response = await server.inject({
      method: 'POST',
      url: `/api/startlists/${STARTLIST_ID}/finalize`,
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('Startlist can only be finalized after assigning start times.');
  });

  it('proxies japan ranking requests to the upstream service', async () => {
    const originalFetch = global.fetch;
    const html = '<html><body>ranking</body></html>';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=UTF-8' }),
      text: async () => html,
    } as Response);

    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/api/japan-ranking/123/2',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://japan-o-entry.com/ranking/ranking/ranking_index/123/2',
      );
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toBe(html);
    } finally {
      if (originalFetch) {
        global.fetch = originalFetch;
      } else {
        delete (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch;
      }
    }
  });

  it('returns 502 when the upstream service cannot be reached', async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));

    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/api/japan-ranking/999/1',
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(response.statusCode).toBe(502);
      expect(response.body).toContain('Failed to fetch Japan ranking data from upstream.');
    } finally {
      if (originalFetch) {
        global.fetch = originalFetch;
      } else {
        delete (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch;
      }
    }
  });

  it('returns 400 when assigning lane order before entering settings', async () => {
    const startlist = Startlist.createNew(StartlistId.create(STARTLIST_ID), SystemClock, {
      eventId: 'event-lane-order-precondition',
      raceId: STARTLIST_ID,
    });
    await module.repository.save(startlist);

    const response = await assignLaneOrder();

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('Startlist settings must be entered before performing this action.');
  });

  it('returns 400 when assigning player order before lane assignments', async () => {
    const settingsResponse = await enterSettings();
    expect(settingsResponse.statusCode).toBe(200);

    const response = await assignPlayerOrder();

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('Lane assignments must be completed before performing this action.');
  });

  it('returns 400 when assigning start times before class assignments', async () => {
    const settingsResponse = await enterSettings();
    expect(settingsResponse.statusCode).toBe(200);
    const laneResponse = await assignLaneOrder();
    expect(laneResponse.statusCode).toBe(200);

    const response = await assignStartTimes();

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('Class assignments must be completed before performing this action.');
  });

  it('clears start times when lane order is manually reassigned', async () => {
    await enterSettings();
    await assignLaneOrder();
    await assignPlayerOrder();
    await assignStartTimes();

    const manualResponse = await server.inject({
      method: 'POST',
      url: `/api/startlists/${STARTLIST_ID}/lane-order/manual`,
      payload: { assignments: LANE_ASSIGNMENTS, reason: 'Manual adjustment' },
    });

    expect(manualResponse.statusCode).toBe(200);
    const manualBody = manualResponse.json();
    expect(manualBody.startTimes).toHaveLength(0);

    const queryResponse = await server.inject({
      method: 'GET',
      url: `/api/startlists/${STARTLIST_ID}`,
    });

    expect(queryResponse.statusCode).toBe(200);
    const queryBody = queryResponse.json();
    expect(queryBody.startTimes).toHaveLength(0);
    expect(queryBody.status).toBe('LANE_ORDER_ASSIGNED');
  });

  it('provides version history and diff endpoints', async () => {
    await enterSettings();
    await assignLaneOrder();
    await assignPlayerOrder();
    await assignStartTimes();
    const finalizeResponse = await server.inject({
      method: 'POST',
      url: `/api/startlists/${STARTLIST_ID}/finalize`,
    });
    expect(finalizeResponse.statusCode).toBe(200);

    const versionsResponse = await server.inject({
      method: 'GET',
      url: `/api/startlists/${STARTLIST_ID}/versions?limit=2`,
    });

    expect(versionsResponse.statusCode).toBe(200);
    const versionsBody = versionsResponse.json();
    expect(versionsBody.total).toBeGreaterThan(0);
    expect(versionsBody.items[0].snapshot.id).toBe(STARTLIST_ID);

    const diffResponse = await server.inject({
      method: 'GET',
      url: `/api/startlists/${STARTLIST_ID}/diff`,
    });

    expect(diffResponse.statusCode).toBe(200);
    const diffBody = diffResponse.json();
    expect(diffBody.to.version).toBeGreaterThan(0);
    expect(diffBody.changes).toBeDefined();
  });
});
