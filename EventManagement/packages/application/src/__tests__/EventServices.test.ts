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
  AttachStartlistService,
  CreateEventService,
  EventNotFoundError,
  type EventRepository,
  type EventServiceDependencies,
  PersistenceError,
  RaceNotFoundError,
  ScheduleRaceService,
  type ScheduleRaceServiceDependencies,
  ValidationError,
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

  describe('AttachStartlistService', () => {
    it('attaches finalized startlists to races and returns the updated event', async () => {
      const dependencies = createDependencies();
      const event = createEvent();
      const race = event.scheduleRace(
        {
          id: RaceId.from('race-attach'),
          name: 'Sprint Final',
          schedule: RaceSchedule.from(new Date('2024-04-05T09:00:00Z')),
        },
        new RaceSchedulingService(),
      );
      const findMock = dependencies.repository.findById as ReturnType<typeof vi.fn>;
      findMock.mockResolvedValue(event);
      const service = new AttachStartlistService(dependencies);

      const result = await service.execute({
        eventId: event.getId().toString(),
        raceId: race.getId().toString(),
        startlistId: 'startlist-final',
        confirmedAt: '2024-04-05T10:00:00.000Z',
        version: 3,
        publicUrl: 'https://startlists.example.com/startlist-final',
        status: 'FINALIZED',
      });

      expect(dependencies.repository.save).toHaveBeenCalledTimes(1);
      expect(result.races).toHaveLength(1);
      expect(result.races[0]?.startlist).toMatchObject({
        id: 'startlist-final',
        status: 'FINALIZED',
        confirmedAt: '2024-04-05T10:00:00.000Z',
        publicVersion: 3,
        publicUrl: 'https://startlists.example.com/startlist-final',
      });
    });

    it('attaches startlists without a public URL', async () => {
      const dependencies = createDependencies();
      const event = createEvent();
      const race = event.scheduleRace(
        {
          id: RaceId.from('race-attach-no-url'),
          name: 'Sprint Final',
          schedule: RaceSchedule.from(new Date('2024-04-05T09:00:00Z')),
        },
        new RaceSchedulingService(),
      );
      const findMock = dependencies.repository.findById as ReturnType<typeof vi.fn>;
      findMock.mockResolvedValue(event);
      const service = new AttachStartlistService(dependencies);

      const result = await service.execute({
        eventId: event.getId().toString(),
        raceId: race.getId().toString(),
        startlistId: 'startlist-without-public',
        confirmedAt: '2024-04-05T10:00:00.000Z',
        version: 2,
        status: 'FINALIZED',
      });

      expect(dependencies.repository.save).toHaveBeenCalledTimes(1);
      expect(result.races[0]?.startlist).toMatchObject({
        id: 'startlist-without-public',
        status: 'FINALIZED',
        confirmedAt: '2024-04-05T10:00:00.000Z',
        publicVersion: 2,
      });
      expect(result.races[0]?.startlist?.publicUrl).toBeUndefined();
    });

    it('throws RaceNotFoundError when the race does not exist', async () => {
      const dependencies = createDependencies();
      const event = createEvent();
      const findMock = dependencies.repository.findById as ReturnType<typeof vi.fn>;
      findMock.mockResolvedValue(event);
      const service = new AttachStartlistService(dependencies);

      await expect(
        service.execute({
          eventId: event.getId().toString(),
          raceId: 'missing',
          startlistId: 'startlist-final',
          confirmedAt: '2024-04-05T10:00:00.000Z',
          version: 2,
          publicUrl: 'https://startlists.example.com/startlist-final',
        }),
      ).rejects.toBeInstanceOf(RaceNotFoundError);
    });

    it('validates URLs before attaching startlists', async () => {
      const dependencies = createDependencies();
      const event = createEvent();
      const race = event.scheduleRace(
        {
          id: RaceId.from('race-invalid'),
          name: 'Sprint Final',
          schedule: RaceSchedule.from(new Date('2024-04-05T09:00:00Z')),
        },
        new RaceSchedulingService(),
      );
      const findMock = dependencies.repository.findById as ReturnType<typeof vi.fn>;
      findMock.mockResolvedValue(event);
      const service = new AttachStartlistService(dependencies);

      await expect(
        service.execute({
          eventId: event.getId().toString(),
          raceId: race.getId().toString(),
          startlistId: 'startlist-final',
          confirmedAt: '2024-04-05T10:00:00.000Z',
          version: 1,
          publicUrl: 'not-a-url',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
