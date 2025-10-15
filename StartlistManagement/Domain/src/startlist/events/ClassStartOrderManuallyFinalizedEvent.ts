import { DomainEvent } from '../../common/DomainEvent.js';
import { ClassAssignment } from '../ClassAssignment.js';

export class ClassStartOrderManuallyFinalizedEvent implements DomainEvent {
  readonly type = 'ClassStartOrderManuallyFinalizedEvent';
  public readonly occurredAt: Date;
  public readonly startlistId: string;
  public readonly classAssignments: ReadonlyArray<ClassAssignment>;

  constructor(
    startlistId: string,
    classAssignments: ReadonlyArray<ClassAssignment>,
    occurredAt: Date,
  ) {
    this.startlistId = startlistId;
    this.classAssignments = [...classAssignments];
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
