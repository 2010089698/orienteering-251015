import { DomainEvent, EventCreated, RaceScheduled } from './events.js';
import { Race } from './race.js';
import { EventPublicationPolicy } from './services/EventPublicationPolicy.js';
import { RaceSchedulingService } from './services/RaceSchedulingService.js';
import { EventDateRange } from './valueObjects/EventDateRange.js';
import { EventId } from './valueObjects/EventId.js';
import { RaceId } from './valueObjects/RaceId.js';
import { RaceSchedule } from './valueObjects/RaceSchedule.js';
import { StartlistLink } from './valueObjects/StartlistLink.js';

export interface EventProps {
  id: EventId;
  name: string;
  dateRange: EventDateRange;
  venue: string;
  allowMultipleRacesPerDay?: boolean;
  allowScheduleOverlap?: boolean;
}

interface ScheduleRaceInput {
  id: RaceId;
  name: string;
  schedule: RaceSchedule;
}

export class Event {
  private readonly id: EventId;

  private readonly name: string;

  private readonly dateRange: EventDateRange;

  private readonly venue: string;

  private allowMultipleRacesPerDay: boolean;

  private allowScheduleOverlap: boolean;

  private readonly races: Race[] = [];

  private readonly domainEvents: DomainEvent[] = [];

  private constructor(props: EventProps) {
    const name = props.name?.trim();
    const venue = props.venue?.trim();

    if (!name) {
      throw new Error('Event name must not be empty.');
    }

    if (!venue) {
      throw new Error('Event venue must not be empty.');
    }

    this.id = props.id;
    this.name = name;
    this.dateRange = props.dateRange;
    this.venue = venue;
    this.allowMultipleRacesPerDay = Boolean(props.allowMultipleRacesPerDay);
    this.allowScheduleOverlap = Boolean(props.allowScheduleOverlap);
  }

  public static create(props: EventProps): Event {
    const event = new Event(props);
    event.recordDomainEvent(new EventCreated(event.id));
    return event;
  }

  public getId(): EventId {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getDateRange(): EventDateRange {
    return this.dateRange;
  }

  public getVenue(): string {
    return this.venue;
  }

  public allowsMultipleRacesPerDay(): boolean {
    return this.allowMultipleRacesPerDay;
  }

  public allowsScheduleOverlap(): boolean {
    return this.allowScheduleOverlap;
  }

  public configureMultipleRacesPerDay(allow: boolean): void {
    this.allowMultipleRacesPerDay = allow;
  }

  public configureScheduleOverlap(allow: boolean): void {
    this.allowScheduleOverlap = allow;
  }

  public scheduleRace(
    input: ScheduleRaceInput,
    schedulingService: RaceSchedulingService
  ): Race {
    const scheduleValidation = schedulingService.validate(this, input.schedule);

    if (scheduleValidation.isDuplicateDay && !this.allowMultipleRacesPerDay) {
      throw new Error('Scheduling multiple races on the same day is not allowed.');
    }

    if (scheduleValidation.overlapsExisting && !this.allowScheduleOverlap) {
      throw new Error('Race schedule overlaps with an existing race.');
    }

    const race = Race.create({
      id: input.id,
      name: input.name,
      schedule: input.schedule,
      isDuplicateDay: scheduleValidation.isDuplicateDay,
      overlapsExisting: scheduleValidation.overlapsExisting
    });

    this.races.push(race);
    this.recordDomainEvent(new RaceScheduled(this.id, race.getId(), race.getSchedule()));
    return race;
  }

  public linkStartlist(raceId: RaceId, link: StartlistLink): void {
    const race = this.findRace(raceId);
    race.attachStartlist(link);
  }

  public getRaces(): readonly Race[] {
    return [...this.races];
  }

  public getRace(raceId: RaceId): Race | undefined {
    return this.races.find((race) => race.getId().equals(raceId));
  }

  public assertCanBePublished(policy: EventPublicationPolicy): void {
    policy.ensureCanPublish(this);
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents.length = 0;
    return events;
  }

  private findRace(raceId: RaceId): Race {
    const race = this.getRace(raceId);
    if (!race) {
      throw new Error(`Race ${raceId.toString()} does not exist in event.`);
    }
    return race;
  }

  private recordDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }
}
