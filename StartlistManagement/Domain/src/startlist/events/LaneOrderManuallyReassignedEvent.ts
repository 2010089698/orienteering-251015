import { DomainEvent } from '../../common/DomainEvent';
import { LaneAssignment } from '../LaneAssignment';

export class LaneOrderManuallyReassignedEvent implements DomainEvent {
  readonly type = 'LaneOrderManuallyReassignedEvent';
  public readonly occurredAt: Date;

  constructor(
    public readonly startlistId: string,
    public readonly laneAssignments: ReadonlyArray<LaneAssignment>,
    occurredAt: Date,
  ) {
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
