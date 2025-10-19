import { DomainEvent } from '../../common/DomainEvent.js';
import { StartTimeDto } from '../StartlistDtos.js';

export class StartTimesAssignedEvent implements DomainEvent {
  readonly type = 'StartTimesAssignedEvent';
  public readonly occurredAt: Date;
  public readonly startlistId: string;
  public readonly startTimes: ReadonlyArray<StartTimeDto>;

  constructor(
    startlistId: string,
    startTimes: ReadonlyArray<StartTimeDto>,
    occurredAt: Date,
  ) {
    this.startlistId = startlistId;
    this.startTimes = startTimes.map((startTime) => ({
      playerId: startTime.playerId,
      startTime: startTime.startTime,
      laneNumber: startTime.laneNumber,
    }));
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
