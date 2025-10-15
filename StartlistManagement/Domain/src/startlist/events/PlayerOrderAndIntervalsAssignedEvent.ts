import { DomainEvent } from '../../common/DomainEvent';
import { ClassAssignment } from '../ClassAssignment';

export class PlayerOrderAndIntervalsAssignedEvent implements DomainEvent {
  readonly type = 'PlayerOrderAndIntervalsAssignedEvent';

  public readonly startlistId: string;
  public readonly classAssignments: ReadonlyArray<ClassAssignment>;
  public readonly occurredAt: Date;

  constructor(
    startlistId: string,
    classAssignments: ReadonlyArray<ClassAssignment>,
    occurredAt: Date,
  ) {
    this.startlistId = startlistId;
    this.classAssignments = Object.freeze(classAssignments.map((assignment) => assignment));
    this.occurredAt = occurredAt;
    Object.freeze(this);
  }
}
