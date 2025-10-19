import { DomainEvent } from '../../common/DomainEvent.js';
import { LaneAssignmentDto } from '../StartlistDtos.js';

export class LaneOrderManuallyReassignedEvent implements DomainEvent {
  readonly type = 'LaneOrderManuallyReassignedEvent';
  public readonly occurredAt: Date;
  public readonly startlistId: string;
  public readonly laneAssignments: ReadonlyArray<LaneAssignmentDto>;

  constructor(
    startlistId: string,
    laneAssignments: ReadonlyArray<LaneAssignmentDto>,
    occurredAt: Date,
  ) {
    this.startlistId = startlistId;
    this.laneAssignments = laneAssignments.map((assignment) => ({
      laneNumber: assignment.laneNumber,
      classOrder: [...assignment.classOrder],
      interval: { milliseconds: assignment.interval.milliseconds },
    }));
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
