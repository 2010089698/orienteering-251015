import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StartlistSyncError } from '@event-management/application';
import { EventId, RaceId } from '@event-management/domain';
import { createEventModule, type EventModule } from '@event-management/infrastructure';
import { createServer, type EventServer } from '../server.js';

const EVENT_ID = 'event-1';
const RACE_ID = 'race-1';

const CREATE_EVENT_PAYLOAD = {
  name: 'National Orienteering',
  startDate: '2024-06-01T00:00:00.000Z',
  endDate: '2024-06-02T23:59:59.000Z',
  venue: 'Mountain Park',
};

const SCHEDULE_RACE_PAYLOAD = {
  name: 'Sprint Qualifier',
  date: '2024-06-01',
};

describe('eventRoutes', () => {
  let server: EventServer;
  let notifyRaceScheduled: ReturnType<typeof vi.fn>;
  let eventModule: EventModule;
  let generateSpy: ReturnType<typeof vi.spyOn>;
  let raceIdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    notifyRaceScheduled = vi.fn().mockResolvedValue(undefined);
    eventModule = createEventModule({ startlistSync: { port: { notifyRaceScheduled } } });
    generateSpy = vi.spyOn(EventId, 'generate').mockImplementation(() => EventId.from(EVENT_ID));
    raceIdSpy = vi.spyOn(RaceId, 'generate').mockImplementation(() => RaceId.from(RACE_ID));
    server = createServer({
      events: {
        createEventService: eventModule.createEventService,
        scheduleRaceService: eventModule.scheduleRaceService,
        attachStartlistService: eventModule.attachStartlistService,
        eventQueryService: eventModule.eventQueryService,
      },
    });
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    generateSpy.mockRestore();
    raceIdSpy.mockRestore();
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
    expect(generateSpy).toHaveBeenCalled();
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
    expect(notifyRaceScheduled.mock.calls[0]?.[0]?.updatedAt).toBeInstanceOf(Date);
  });

  it('still schedules races when the startlist sync endpoint is unavailable', async () => {
    await server.inject({ method: 'POST', url: '/api/events', payload: CREATE_EVENT_PAYLOAD });
    notifyRaceScheduled.mockRejectedValueOnce(new StartlistSyncError('Not implemented'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await server.inject({
      method: 'POST',
      url: `/api/events/${EVENT_ID}/races`,
      payload: SCHEDULE_RACE_PAYLOAD,
    });

    consoleSpy.mockRestore();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.event.races).toHaveLength(1);
    expect(body.event.races[0]?.id).toBe(RACE_ID);
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
      payload: {
        startlistId: 'startlist-123',
        startlistLink: 'https://example.com/startlist',
        startlistUpdatedAt: '2024-04-05T09:00:00.000Z',
        startlistPublicVersion: 4,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.event.races[0]?.startlistLink).toBe('https://example.com/startlist');
    expect(body.event.races[0]?.startlistUpdatedAt).toBe('2024-04-05T09:00:00.000Z');
    expect(body.event.races[0]?.startlistPublicVersion).toBe(4);
    expect(body.event.races[0]?.startlistId).toBe('startlist-123');
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

  it('returns 502 when the startlist sync service fails', async () => {
    const scheduleSpy = vi
      .spyOn(eventModule.scheduleRaceService, 'execute')
      .mockRejectedValueOnce(new StartlistSyncError('Sync failed'));

    await server.inject({ method: 'POST', url: '/api/events', payload: CREATE_EVENT_PAYLOAD });

    const response = await server.inject({
      method: 'POST',
      url: `/api/events/${EVENT_ID}/races`,
      payload: SCHEDULE_RACE_PAYLOAD,
    });

    scheduleSpy.mockRestore();

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      message: 'Startlist synchronization service is unavailable.',
    });
  });

  it('returns 404 when attaching a startlist to a missing race', async () => {
    await server.inject({ method: 'POST', url: '/api/events', payload: CREATE_EVENT_PAYLOAD });
    const response = await server.inject({
      method: 'POST',
      url: `/api/events/${EVENT_ID}/races/${RACE_ID}/startlist`,
      payload: { startlistId: 'startlist-123', startlistLink: 'https://example.com/startlist' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().message).toContain(RACE_ID);
  });
});
