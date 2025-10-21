import { describe, expect, it, vi } from 'vitest';
import {
  AttachStartlistService,
  CreateEventService,
  EventQueryService,
  ScheduleRaceService,
} from '@event-management/application';
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
    expect(module.attachStartlistService).toBeInstanceOf(AttachStartlistService);
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

  it('subscribes startlist sync ports to race scheduled events', async () => {
    const notifyRaceScheduled = vi.fn().mockResolvedValue(undefined);
    const module = createEventModule({
      startlistSync: { port: { notifyRaceScheduled } },
    });

    const generatedId = EventId.from(EVENT_ID);
    const generateSpy = vi.spyOn(EventId, 'generate').mockReturnValue(generatedId);

    await module.createEventService.execute(buildCreateEventPayload());

    const generatedRaceId = RaceId.from('race-1');
    const raceIdSpy = vi.spyOn(RaceId, 'generate').mockReturnValue(generatedRaceId);

    await module.scheduleRaceService.execute({
      eventId: EVENT_ID,
      name: 'Sprint Qualifier',
      date: '2024-04-01',
    });

    expect(notifyRaceScheduled).toHaveBeenCalledTimes(1);
    const call = notifyRaceScheduled.mock.calls[0]?.[0];
    expect(call?.eventId).toBeInstanceOf(EventId);
    expect(call?.raceId).toBeInstanceOf(RaceId);
    expect(call?.schedule).toBeInstanceOf(RaceSchedule);
    expect(call?.updatedAt).toBeInstanceOf(Date);
    raceIdSpy.mockRestore();
    generateSpy.mockRestore();
  });
});
