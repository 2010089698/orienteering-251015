import { DomainEvent } from '../../common/DomainEvent';

export class StartTimesInvalidatedEvent implements DomainEvent {
  readonly type = 'StartTimesInvalidatedEvent';

  constructor(
    public readonly startlistId: string,
    public readonly reason: string,
    public readonly occurredAt: Date,
  ) {}
}
