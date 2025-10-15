import { DomainEvent } from '../../common/DomainEvent';
import { ClassAssignment } from '../ClassAssignment';

export class ClassStartOrderManuallyFinalizedEvent implements DomainEvent {
  readonly type = 'ClassStartOrderManuallyFinalizedEvent';

  constructor(
    public readonly startlistId: string,
    public readonly classAssignments: ReadonlyArray<ClassAssignment>,
    public readonly occurredAt: Date,
  ) {}
}
