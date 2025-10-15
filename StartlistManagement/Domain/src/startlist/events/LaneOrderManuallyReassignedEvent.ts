import { DomainEvent } from '../../common/DomainEvent';
import { LaneAssignment } from '../LaneAssignment';

export class LaneOrderManuallyReassignedEvent implements DomainEvent {
  readonly type = 'LaneOrderManuallyReassignedEvent';

  constructor(
    public readonly startlistId: string,
    public readonly laneAssignments: ReadonlyArray<LaneAssignment>,
    public readonly occurredAt: Date,
  ) {}
}
