import { DomainEvent } from '../../common/DomainEvent';
import { LaneAssignment } from '../LaneAssignment';

export class LaneOrderAndIntervalsAssignedEvent implements DomainEvent {
  readonly type = 'LaneOrderAndIntervalsAssignedEvent';

  public readonly startlistId: string;
  public readonly laneAssignments: ReadonlyArray<LaneAssignment>;
  public readonly occurredAt: Date;

  constructor(
    startlistId: string,
    laneAssignments: ReadonlyArray<LaneAssignment>,
    occurredAt: Date,
  ) {
    this.startlistId = startlistId;
    this.laneAssignments = Object.freeze(laneAssignments.map((assignment) => assignment));
    this.occurredAt = occurredAt;
    Object.freeze(this);
  }
}
