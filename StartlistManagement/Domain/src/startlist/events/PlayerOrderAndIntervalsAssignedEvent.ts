import { DomainEvent } from '../../common/DomainEvent';
import { ClassAssignment } from '../ClassAssignment';

export class PlayerOrderAndIntervalsAssignedEvent implements DomainEvent {
  readonly type = 'PlayerOrderAndIntervalsAssignedEvent';

  constructor(
    public readonly startlistId: string,
    public readonly classAssignments: ReadonlyArray<ClassAssignment>,
    public readonly occurredAt: Date,
  ) {}
}
