import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStartlistModule } from '../../../../Infrastructure/src/config/startlistModule.js';
import { createServer, StartlistServer } from '../server.js';

const STARTLIST_ID = 'startlist-1';
const SETTINGS_PAYLOAD = {
  eventId: 'event-1',
  startTime: '2024-01-01T10:00:00.000Z',
  interval: { milliseconds: 600000 },
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

  beforeEach(async () => {
    const module = createStartlistModule();
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

  it('creates a startlist and returns the snapshot state', async () => {
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
    expect(body.status).toBe('START_TIMES_ASSIGNED');
    expect(body.startTimes).toHaveLength(START_TIMES.length);
    expect(body.settings.eventId).toBe(SETTINGS_PAYLOAD.eventId);
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
});
