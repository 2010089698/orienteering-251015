import { describe, expect, it } from 'vitest';

import {
  Event,
  EventDateRange,
  EventId,
  EventPublicationPolicy,
  EventCreated,
  RaceId,
  RaceSchedule,
  RaceSchedulingService,
  RaceScheduled,
  StartlistLink
} from '../index.js';

describe('Event aggregate', () => {
  const createDateRange = () =>
    EventDateRange.from(new Date('2024-04-01T00:00:00Z'), new Date('2024-04-07T23:59:59Z'));

  const createEvent = () =>
    Event.create({
      id: EventId.from('event-1'),
      name: 'Spring Orienteering',
      dateRange: createDateRange(),
      venue: 'Central Park'
    });

  it('records a domain event when created', () => {
    const event = createEvent();
    const [domainEvent] = event.pullDomainEvents();

    expect(domainEvent).toBeInstanceOf(EventCreated);
    expect(domainEvent?.eventId.toString()).toBe('event-1');
  });

  it('schedules a race and emits RaceScheduled event', () => {
    const event = createEvent();
    const schedulingService = new RaceSchedulingService();

    const race = event.scheduleRace(
      {
        id: RaceId.from('race-1'),
        name: 'Sprint Qualification',
        schedule: RaceSchedule.from(new Date('2024-04-02T08:00:00Z'))
      },
      schedulingService
    );

    expect(event.getRaces()).toHaveLength(1);
    expect(race.getId().toString()).toBe('race-1');

    const events = event.pullDomainEvents();
    const raceScheduledEvent = events.find((domainEvent) => domainEvent instanceof RaceScheduled);
    expect(raceScheduledEvent).toBeInstanceOf(RaceScheduled);
    expect((raceScheduledEvent as RaceScheduled)?.raceId.toString()).toBe('race-1');
  });

  it('flags duplicate day races when allowed', () => {
    const event = createEvent();
    event.configureMultipleRacesPerDay(true);
    const schedulingService = new RaceSchedulingService();

    event.scheduleRace(
      {
        id: RaceId.from('race-1'),
        name: 'Morning Sprint',
        schedule: RaceSchedule.from(new Date('2024-04-03T08:00:00Z'))
      },
      schedulingService
    );

    const duplicate = event.scheduleRace(
      {
        id: RaceId.from('race-2'),
        name: 'Evening Sprint',
        schedule: RaceSchedule.from(new Date('2024-04-03T16:00:00Z'))
      },
      schedulingService
    );

    expect(duplicate.hasDuplicateDay()).toBe(true);
  });

  it('attaches a startlist to a race and validates publication preconditions', () => {
    const event = createEvent();
    const schedulingService = new RaceSchedulingService();
    const race = event.scheduleRace(
      {
        id: RaceId.from('race-1'),
        name: 'Long Distance',
        schedule: RaceSchedule.from(new Date('2024-04-05T09:00:00Z'))
      },
      schedulingService
    );

    const link = StartlistLink.from('https://example.com/startlist');
    event.linkStartlist(race.getId(), link);

    const storedRace = event.getRace(race.getId());
    expect(storedRace?.getStartlistLink()?.toString()).toBe('https://example.com/startlist');

    const publicationPolicy = new EventPublicationPolicy();
    expect(() => event.assertCanBePublished(publicationPolicy)).not.toThrow();
  });
});
