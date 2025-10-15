import { DomainEvent } from '../../common/DomainEvent.js';
import { StartTime } from '../StartTime.js';

export class StartTimesAssignedEvent implements DomainEvent {
  readonly type = 'StartTimesAssignedEvent';
  public readonly occurredAt: Date;
  public readonly startlistId: string;
  public readonly startTimes: ReadonlyArray<StartTime>;

  constructor(
    startlistId: string,
    startTimes: ReadonlyArray<StartTime>,
    occurredAt: Date,
  ) {
    this.startlistId = startlistId;
    this.startTimes = [...startTimes];
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
