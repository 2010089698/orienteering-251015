import { EventId } from './valueObjects/EventId.js';
import { RaceId } from './valueObjects/RaceId.js';
import { RaceSchedule } from './valueObjects/RaceSchedule.js';

export interface DomainEvent {
  readonly occurredAt: Date;
}

export class EventCreated implements DomainEvent {
  public readonly occurredAt: Date;

  constructor(public readonly eventId: EventId) {
    this.occurredAt = new Date();
  }
}

export class RaceScheduled implements DomainEvent {
  public readonly occurredAt: Date;

  constructor(
    public readonly eventId: EventId,
    public readonly raceId: RaceId,
    public readonly schedule: RaceSchedule
  ) {
    this.occurredAt = new Date();
  }
}
