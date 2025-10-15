import { DomainEvent } from '../../common/DomainEvent';
import { LaneAssignment } from '../LaneAssignment';

export class LaneOrderAndIntervalsAssignedEvent implements DomainEvent {
  readonly type = 'LaneOrderAndIntervalsAssignedEvent';
  public readonly occurredAt: Date;

  constructor(
    public readonly startlistId: string,
    public readonly laneAssignments: ReadonlyArray<LaneAssignment>,
    occurredAt: Date,
  ) {
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
