import {
  Event,
  EventCreated,
  EventDateRange,
  EventId,
  RaceId,
  RaceSchedule,
  RaceScheduled,
  RaceSchedulingService,
} from '@event-management/domain';
import { describe, expect, it, vi } from 'vitest';

import {
  CreateEventService,
  EventNotFoundError,
  type EventRepository,
  type EventServiceDependencies,
  PersistenceError,
  ScheduleRaceService,
  type ScheduleRaceServiceDependencies,
} from '../index.js';

function createDateRange(): EventDateRange {
  return EventDateRange.from(new Date('2024-04-01T00:00:00Z'), new Date('2024-04-07T23:59:59Z'));
}

function createEvent(): Event {
  const event = Event.create({
    id: EventId.from('event-1'),
    name: 'Spring Orienteering',
    dateRange: createDateRange(),
    venue: 'Central Park',
  });
  event.pullDomainEvents();
  return event;
}

function createDependencies(): EventServiceDependencies {
  const repository: EventRepository = {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
  };
  const transactionManager = {
    execute: vi.fn(async <T>(work: () => Promise<T> | T) => await work()),
  };
  const eventPublisher = {
    publish: vi.fn().mockResolvedValue(undefined),
  };

  return { repository, transactionManager, eventPublisher };
}

describe('Event application services', () => {
  describe('CreateEventService', () => {
    it('persists and publishes a newly created event', async () => {
      const dependencies = createDependencies();
      const service = new CreateEventService(dependencies);
      const generatedId = EventId.from('event-99');
      const generateSpy = vi.spyOn(EventId, 'generate').mockReturnValue(generatedId);
      const input = {
        name: 'Night Orienteering',
        startDate: '2024-06-01T09:00:00.000Z',
        endDate: '2024-06-02T17:00:00.000Z',
        venue: 'Mountain Arena',
      };

      const result = await service.execute(input);

      expect(generateSpy).toHaveBeenCalledTimes(1);
      expect(dependencies.transactionManager.execute).toHaveBeenCalledTimes(1);
      expect(dependencies.repository.save).toHaveBeenCalledTimes(1);
      const publishMock = dependencies.eventPublisher.publish as ReturnType<typeof vi.fn>;
      expect(publishMock).toHaveBeenCalledTimes(1);
      const publishedEvents = publishMock.mock.calls[0][0];
      expect(publishedEvents[0]).toBeInstanceOf(EventCreated);
      expect(result).toMatchObject({
        id: 'event-99',
        name: 'Night Orienteering',
        venue: 'Mountain Arena',
        allowMultipleRacesPerDay: true,
        allowScheduleOverlap: true,
        races: [],
      });
      generateSpy.mockRestore();
    });

    it('wraps persistence errors into PersistenceError', async () => {
      const dependencies = createDependencies();
      const saveMock = dependencies.repository.save as ReturnType<typeof vi.fn>;
      saveMock.mockRejectedValue(new Error('boom'));
      const service = new CreateEventService(dependencies);
      const generatedId = EventId.from('event-2');
      const generateSpy = vi.spyOn(EventId, 'generate').mockReturnValue(generatedId);

      await expect(
        service.execute({
          name: 'Spring Gala',
          startDate: '2024-05-01T09:00:00.000Z',
          endDate: '2024-05-02T17:00:00.000Z',
          venue: 'Forest Edge',
        }),
      ).rejects.toBeInstanceOf(PersistenceError);

      generateSpy.mockRestore();
    });
  });

  describe('ScheduleRaceService', () => {
    it('schedules a race within a transaction and publishes events', async () => {
      const dependencies = createDependencies() as ScheduleRaceServiceDependencies;
      const event = createEvent();
      const findMock = dependencies.repository.findById as ReturnType<typeof vi.fn>;
      findMock.mockResolvedValue(event);
      const service = new ScheduleRaceService({
        ...dependencies,
        raceSchedulingService: new RaceSchedulingService(),
      });
      const generatedRaceId = RaceId.from('race-123');
      const raceIdSpy = vi.spyOn(RaceId, 'generate').mockReturnValue(generatedRaceId);

      const result = await service.execute({
        eventId: 'event-1',
        name: 'Sprint Heats',
        date: '2024-04-02',
      });

      expect(dependencies.transactionManager.execute).toHaveBeenCalledTimes(1);
      expect(dependencies.repository.save).toHaveBeenCalledTimes(1);
      expect(result.races).toHaveLength(1);
      expect(result.races[0]?.id).toBe('race-123');
      const publishMock = dependencies.eventPublisher.publish as ReturnType<typeof vi.fn>;
      expect(publishMock).toHaveBeenCalledTimes(1);
      const publishedEvents = publishMock.mock.calls[0][0];
      expect(publishedEvents[0]).toBeInstanceOf(RaceScheduled);
      raceIdSpy.mockRestore();
    });

    it('throws EventNotFoundError when event is missing', async () => {
      const dependencies = createDependencies() as ScheduleRaceServiceDependencies;
      const findMock = dependencies.repository.findById as ReturnType<typeof vi.fn>;
      findMock.mockResolvedValue(undefined);
      const service = new ScheduleRaceService({
        ...dependencies,
        raceSchedulingService: new RaceSchedulingService(),
      });

    await expect(
      service.execute({
        eventId: 'missing',
        name: 'Qualifier',
        date: '2024-04-02',
      }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
  });

    it('creates startlists when a sync port is provided', async () => {
      const dependencies = createDependencies() as ScheduleRaceServiceDependencies;
      const event = createEvent();
      const findMock = dependencies.repository.findById as ReturnType<typeof vi.fn>;
      findMock.mockResolvedValue(event);
      const createStartlist = vi
        .fn()
        .mockResolvedValue({ startlistId: 'startlist-123', status: 'draft' });
      const notifyRaceScheduled = vi.fn().mockResolvedValue(undefined);
      const service = new ScheduleRaceService({
        ...dependencies,
        raceSchedulingService: new RaceSchedulingService(),
        startlistSyncPort: { createStartlist, notifyRaceScheduled },
      });
      const generatedRaceId = RaceId.from('race-456');
      const raceIdSpy = vi.spyOn(RaceId, 'generate').mockReturnValue(generatedRaceId);

      const result = await service.execute({
        eventId: 'event-1',
        name: 'Sprint Final',
        date: '2024-04-04',
      });

      expect(createStartlist).toHaveBeenCalledTimes(1);
      const call = createStartlist.mock.calls[0]?.[0];
      expect(call?.eventId).toBeInstanceOf(EventId);
      expect(call?.raceId).toBeInstanceOf(RaceId);
      expect(call?.schedule).toBeInstanceOf(RaceSchedule);
      expect(call?.updatedAt).toBeInstanceOf(Date);
      expect(result.races[0]?.startlist).toEqual({ id: 'startlist-123', status: 'draft' });
      raceIdSpy.mockRestore();
    });
  });

});
