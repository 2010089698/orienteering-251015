import { DomainEvent } from '../../common/DomainEvent';
import { ClassAssignment } from '../ClassAssignment';

export class ClassStartOrderManuallyFinalizedEvent implements DomainEvent {
  readonly type = 'ClassStartOrderManuallyFinalizedEvent';
  public readonly occurredAt: Date;

  constructor(
    public readonly startlistId: string,
    public readonly classAssignments: ReadonlyArray<ClassAssignment>,
    occurredAt: Date,
  ) {
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
