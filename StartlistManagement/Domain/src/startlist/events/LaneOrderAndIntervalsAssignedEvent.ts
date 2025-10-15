import { DomainEvent } from '../../common/DomainEvent';
import { LaneAssignment } from '../LaneAssignment';

export class LaneOrderAndIntervalsAssignedEvent implements DomainEvent {
  readonly type = 'LaneOrderAndIntervalsAssignedEvent';

  constructor(
    public readonly startlistId: string,
    public readonly laneAssignments: ReadonlyArray<LaneAssignment>,
    public readonly occurredAt: Date,
  ) {}
}
