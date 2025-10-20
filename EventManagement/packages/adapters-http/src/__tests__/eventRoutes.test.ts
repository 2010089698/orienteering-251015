import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventModule } from '@event-management/infrastructure';
import { createServer, type EventServer } from '../server.js';

const EVENT_ID = 'event-1';
const RACE_ID = 'race-1';

const CREATE_EVENT_PAYLOAD = {
  eventId: EVENT_ID,
  name: 'National Orienteering',
  startDate: '2024-06-01T09:00:00.000Z',
  endDate: '2024-06-02T17:00:00.000Z',
  venue: 'Mountain Park',
};

const SCHEDULE_RACE_PAYLOAD = {
  raceId: RACE_ID,
  name: 'Sprint Qualifier',
  start: '2024-06-01T10:00:00.000Z',
  end: '2024-06-01T11:00:00.000Z',
};

describe('eventRoutes', () => {
  let server: EventServer;
  let notifyRaceScheduled: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    notifyRaceScheduled = vi.fn().mockResolvedValue(undefined);
    const module = createEventModule({ startlistSync: { port: { notifyRaceScheduled } } });
    server = createServer({
      events: {
        createEventService: module.createEventService,
        scheduleRaceService: module.scheduleRaceService,
        attachStartlistService: module.attachStartlistService,
        eventQueryService: module.eventQueryService,
      },
    });
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  it('responds to health checks', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('creates and lists events', async () => {
    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/events',
      payload: CREATE_EVENT_PAYLOAD,
    });
    expect(createResponse.statusCode).toBe(201);
    const createdBody = createResponse.json();
    expect(createdBody.event.allowMultipleRacesPerDay).toBe(true);
    expect(createdBody.event.allowScheduleOverlap).toBe(true);

    const listResponse = await server.inject({ method: 'GET', url: '/api/events' });
    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json();
    expect(listBody.events).toHaveLength(1);
    expect(listBody.events[0]?.id).toBe(EVENT_ID);
    expect(listBody.events[0]?.allowMultipleRacesPerDay).toBe(true);
    expect(listBody.events[0]?.allowScheduleOverlap).toBe(true);
  });

  it('returns 400 for invalid create payloads', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/events',
      payload: { ...CREATE_EVENT_PAYLOAD, name: '' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('must NOT have fewer than 1 characters');
  });

  it('returns 404 when fetching a missing event', async () => {
    const response = await server.inject({ method: 'GET', url: '/api/events/missing' });
    expect(response.statusCode).toBe(404);
    expect(response.json().message).toContain('missing');
  });

  it('schedules races and notifies startlist sync ports', async () => {
    await server.inject({ method: 'POST', url: '/api/events', payload: CREATE_EVENT_PAYLOAD });
    const response = await server.inject({
      method: 'POST',
      url: `/api/events/${EVENT_ID}/races`,
      payload: SCHEDULE_RACE_PAYLOAD,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.event.races).toHaveLength(1);
    expect(body.event.races[0]?.id).toBe(RACE_ID);
    expect(body.event.allowMultipleRacesPerDay).toBe(true);
    expect(body.event.allowScheduleOverlap).toBe(true);
    expect(notifyRaceScheduled).toHaveBeenCalledTimes(1);
  });

  it('attaches startlist links to races', async () => {
    await server.inject({ method: 'POST', url: '/api/events', payload: CREATE_EVENT_PAYLOAD });
    await server.inject({
      method: 'POST',
      url: `/api/events/${EVENT_ID}/races`,
      payload: SCHEDULE_RACE_PAYLOAD,
    });

    const response = await server.inject({
      method: 'POST',
      url: `/api/events/${EVENT_ID}/races/${RACE_ID}/startlist`,
      payload: { startlistLink: 'https://example.com/startlist' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.event.races[0]?.startlistLink).toBe('https://example.com/startlist');
    expect(body.event.allowMultipleRacesPerDay).toBe(true);
    expect(body.event.allowScheduleOverlap).toBe(true);
  });

  it('returns 404 when scheduling a race for an unknown event', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/events/missing/races',
      payload: SCHEDULE_RACE_PAYLOAD,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().message).toContain('missing');
  });

  it('returns 404 when attaching a startlist to a missing race', async () => {
    await server.inject({ method: 'POST', url: '/api/events', payload: CREATE_EVENT_PAYLOAD });
    const response = await server.inject({
      method: 'POST',
      url: `/api/events/${EVENT_ID}/races/${RACE_ID}/startlist`,
      payload: { startlistLink: 'https://example.com/startlist' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().message).toContain(RACE_ID);
  });
});
