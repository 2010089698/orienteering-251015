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
    eventId: EVENT_ID,
    name: 'Orienteering Cup',
    startDate: '2024-04-01T09:00:00.000Z',
    endDate: '2024-04-02T17:00:00.000Z',
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
    const created = await module.createEventService.execute(createPayload);
    expect(created.id).toBe(EVENT_ID);

    const queryResult = await module.eventQueryService.getById(EVENT_ID);
    expect(queryResult?.id).toBe(EVENT_ID);
    expect(queryResult?.races).toHaveLength(0);
  });

  it('subscribes startlist sync ports to race scheduled events', async () => {
    const notifyRaceScheduled = vi.fn().mockResolvedValue(undefined);
    const module = createEventModule({
      startlistSync: { port: { notifyRaceScheduled } },
    });

    await module.createEventService.execute(buildCreateEventPayload());

    await module.scheduleRaceService.execute({
      eventId: EVENT_ID,
      raceId: 'race-1',
      name: 'Sprint Qualifier',
      start: '2024-04-01T10:00:00.000Z',
      end: '2024-04-01T11:00:00.000Z',
    });

    expect(notifyRaceScheduled).toHaveBeenCalledTimes(1);
    const call = notifyRaceScheduled.mock.calls[0]?.[0];
    expect(call?.eventId).toBeInstanceOf(EventId);
    expect(call?.raceId).toBeInstanceOf(RaceId);
    expect(call?.schedule).toBeInstanceOf(RaceSchedule);
    expect(call?.updatedAt).toBeInstanceOf(Date);
  });
});
