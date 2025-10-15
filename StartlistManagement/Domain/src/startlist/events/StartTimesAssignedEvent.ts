import { DomainEvent } from '../../common/DomainEvent';
import { StartTime } from '../StartTime';

export class StartTimesAssignedEvent implements DomainEvent {
  readonly type = 'StartTimesAssignedEvent';
  public readonly occurredAt: Date;

  constructor(
    public readonly startlistId: string,
    public readonly startTimes: ReadonlyArray<StartTime>,
    occurredAt: Date,
  ) {
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
