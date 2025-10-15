import { DomainEvent } from '../../common/DomainEvent';
import { StartTime } from '../StartTime';

export class StartTimesAssignedEvent implements DomainEvent {
  readonly type = 'StartTimesAssignedEvent';

  public readonly startlistId: string;
  public readonly startTimes: ReadonlyArray<StartTime>;
  public readonly occurredAt: Date;

  constructor(startlistId: string, startTimes: ReadonlyArray<StartTime>, occurredAt: Date) {
    this.startlistId = startlistId;
    this.startTimes = Object.freeze(startTimes.map((startTime) => startTime));
    this.occurredAt = occurredAt;
    Object.freeze(this);
  }
}
