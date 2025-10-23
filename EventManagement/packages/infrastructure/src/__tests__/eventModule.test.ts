import { describe, expect, it, vi } from 'vitest';
import { CreateEventService, EventQueryService, ScheduleRaceService } from '@event-management/application';
import { EventId, RaceId, RaceSchedule } from '@event-management/domain';

import { createEventModule } from '../config/eventModule.js';

const EVENT_ID = 'event-1';

function buildCreateEventPayload() {
  return {
    name: 'Orienteering Cup',
    startDate: '2024-04-01T00:00:00.000Z',
    endDate: '2024-04-02T23:59:59.000Z',
    venue: 'Forest Arena',
  };
}

describe('createEventModule', () => {
  it('wires application services with shared in-memory stores', async () => {
    const module = createEventModule();

    expect(module.repository).toBeDefined();
    expect(module.queryRepository).toBeDefined();
    expect(module.transactionManager).toBeDefined();
    expect(module.domainEventBus).toBeDefined();
    expect(module.createEventService).toBeInstanceOf(CreateEventService);
    expect(module.scheduleRaceService).toBeInstanceOf(ScheduleRaceService);
    expect(module.eventQueryService).toBeInstanceOf(EventQueryService);

    const createPayload = buildCreateEventPayload();
    const generatedId = EventId.from(EVENT_ID);
    const generateSpy = vi.spyOn(EventId, 'generate').mockReturnValue(generatedId);
    const created = await module.createEventService.execute(createPayload);
    expect(created.id).toBe(EVENT_ID);

    const queryResult = await module.eventQueryService.getById(EVENT_ID);
    expect(queryResult?.id).toBe(EVENT_ID);
    expect(queryResult?.races).toHaveLength(0);
    generateSpy.mockRestore();
  });

  it('creates startlists when scheduling races and notifies sync subscribers', async () => {
    const notifyRaceScheduled = vi.fn().mockResolvedValue(undefined);
    const createStartlist = vi
      .fn()
      .mockResolvedValue({ startlistId: 'startlist-1', status: 'draft' });
    const module = createEventModule({
      startlistSync: { port: { notifyRaceScheduled, createStartlist } },
    });

    const generatedId = EventId.from(EVENT_ID);
    const generateSpy = vi.spyOn(EventId, 'generate').mockReturnValue(generatedId);

    await module.createEventService.execute(buildCreateEventPayload());

    const generatedRaceId = RaceId.from('race-1');
    const raceIdSpy = vi.spyOn(RaceId, 'generate').mockReturnValue(generatedRaceId);

    const event = await module.scheduleRaceService.execute({
      eventId: EVENT_ID,
      name: 'Sprint Qualifier',
      date: '2024-04-01',
    });

    expect(createStartlist).toHaveBeenCalledTimes(1);
    const createCall = createStartlist.mock.calls[0]?.[0];
    expect(createCall?.eventId).toBeInstanceOf(EventId);
    expect(createCall?.raceId).toBeInstanceOf(RaceId);
    expect(createCall?.schedule).toBeInstanceOf(RaceSchedule);
    expect(createCall?.updatedAt).toBeInstanceOf(Date);

    expect(event.races[0]?.startlist).toEqual({ id: 'startlist-1', status: 'draft' });

    expect(notifyRaceScheduled).toHaveBeenCalledTimes(1);
    const notifyCall = notifyRaceScheduled.mock.calls[0]?.[0];
    expect(notifyCall?.eventId).toBeInstanceOf(EventId);
    expect(notifyCall?.raceId).toBeInstanceOf(RaceId);
    expect(notifyCall?.schedule).toBeInstanceOf(RaceSchedule);
    expect(notifyCall?.updatedAt).toBeInstanceOf(Date);

    raceIdSpy.mockRestore();
    generateSpy.mockRestore();
  });
});
