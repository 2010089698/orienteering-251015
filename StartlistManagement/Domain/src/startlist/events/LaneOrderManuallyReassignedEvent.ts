import { DomainEvent } from '../../common/DomainEvent';
import { LaneAssignment } from '../LaneAssignment';

export class LaneOrderManuallyReassignedEvent implements DomainEvent {
  readonly type = 'LaneOrderManuallyReassignedEvent';
  public readonly occurredAt: Date;
  public readonly startlistId: string;
  public readonly laneAssignments: ReadonlyArray<LaneAssignment>;

  constructor(
    startlistId: string,
    laneAssignments: ReadonlyArray<LaneAssignment>,
    occurredAt: Date,
  ) {
    this.startlistId = startlistId;
    this.laneAssignments = [...laneAssignments];
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
