import { DomainEvent } from '../../common/DomainEvent.js';

export class StartTimesInvalidatedEvent implements DomainEvent {
  readonly type = 'StartTimesInvalidatedEvent';
  public readonly occurredAt: Date;

  constructor(
    public readonly startlistId: string,
    public readonly reason: string,
    occurredAt: Date,
  ) {
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
