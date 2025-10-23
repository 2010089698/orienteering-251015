import { describe, expect, it, vi } from 'vitest';
import { StartlistSyncError } from '@event-management/application';
import { EventId, RaceId, RaceSchedule } from '@event-management/domain';

import { HttpStartlistSyncPort } from '../sync/HttpStartlistSyncPort.js';

describe('HttpStartlistSyncPort', () => {
  it('posts race schedules to the configured endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => JSON.stringify({ id: 'startlist-1', status: 'draft' }),
    });

    const port = new HttpStartlistSyncPort({
      baseUrl: 'https://startlists.test',
      fetchImpl: fetchMock,
    });

    await port.notifyRaceScheduled({
      eventId: EventId.from('event-123'),
      raceId: RaceId.from('race-999'),
      schedule: RaceSchedule.from(
        new Date('2024-05-01T10:00:00.000Z'),
        new Date('2024-05-01T11:00:00.000Z'),
      ),
      updatedAt: new Date('2024-04-30T12:00:00.000Z'),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://startlists.test/api/startlists');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(init?.body).toContain('event-123');
    expect(init?.body).toContain('race-999');
    expect(init?.body).toContain('2024-04-30T12:00:00.000Z');
  });

  it('creates startlists and returns the identifier and status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          startlistId: 'startlist-777',
          created: true,
          status: 'DRAFT',
          snapshot: { status: 'DRAFT' },
        }),
    });

    const port = new HttpStartlistSyncPort({
      baseUrl: 'https://startlists.test',
      fetchImpl: fetchMock,
    });

    const result = await port.createStartlist({
      eventId: EventId.from('event-123'),
      raceId: RaceId.from('race-999'),
      schedule: RaceSchedule.from(new Date('2024-05-01T10:00:00.000Z')),
      updatedAt: new Date('2024-04-30T12:00:00.000Z'),
    });

    expect(result).toEqual({ startlistId: 'startlist-777', status: 'DRAFT' });
  });

  it('throws a StartlistSyncError when the upstream service responds with an error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });

    const port = new HttpStartlistSyncPort({
      baseUrl: 'https://startlists.test',
      fetchImpl: fetchMock,
    });

    const action = port.notifyRaceScheduled({
      eventId: EventId.from('event-1'),
      raceId: RaceId.from('race-1'),
      schedule: RaceSchedule.from(new Date('2024-05-01T10:00:00.000Z')),
      updatedAt: new Date('2024-04-30T12:00:00.000Z'),
    });

    await expect(action).rejects.toBeInstanceOf(StartlistSyncError);
    await expect(action).rejects.toThrow('Failed to sync startlist: 500 boom');
  });

  it('wraps network errors in a StartlistSyncError', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('connection lost'));

    const port = new HttpStartlistSyncPort({
      baseUrl: 'https://startlists.test',
      fetchImpl: fetchMock,
    });

    const action = port.notifyRaceScheduled({
      eventId: EventId.from('event-1'),
      raceId: RaceId.from('race-1'),
      schedule: RaceSchedule.from(new Date('2024-05-01T10:00:00.000Z')),
      updatedAt: new Date('2024-04-30T12:00:00.000Z'),
    });

    await expect(action).rejects.toBeInstanceOf(StartlistSyncError);
    await expect(action).rejects.toThrow('Failed to sync startlist.');
  });
});
