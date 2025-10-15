import { DomainEvent } from '../../common/DomainEvent';
import { StartTime } from '../StartTime';

export class StartTimesAssignedEvent implements DomainEvent {
  readonly type = 'StartTimesAssignedEvent';

  constructor(
    public readonly startlistId: string,
    public readonly startTimes: ReadonlyArray<StartTime>,
    public readonly occurredAt: Date,
  ) {}
}
