import { DomainEvent } from '../../common/DomainEvent.js';
import { ClassAssignmentDto } from '../StartlistDtos.js';

export class PlayerOrderAndIntervalsAssignedEvent implements DomainEvent {
  readonly type = 'PlayerOrderAndIntervalsAssignedEvent';
  public readonly occurredAt: Date;
  public readonly startlistId: string;
  public readonly classAssignments: ReadonlyArray<ClassAssignmentDto>;

  constructor(
    startlistId: string,
    classAssignments: ReadonlyArray<ClassAssignmentDto>,
    occurredAt: Date,
  ) {
    this.startlistId = startlistId;
    this.classAssignments = classAssignments.map((assignment) => ({
      classId: assignment.classId,
      playerOrder: [...assignment.playerOrder],
      interval: { milliseconds: assignment.interval.milliseconds },
    }));
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
