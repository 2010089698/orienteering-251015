import { DomainEvent } from '../../common/DomainEvent.js';
import { LaneAssignment } from '../LaneAssignment.js';

export class LaneOrderAndIntervalsAssignedEvent implements DomainEvent {
  readonly type = 'LaneOrderAndIntervalsAssignedEvent';
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
