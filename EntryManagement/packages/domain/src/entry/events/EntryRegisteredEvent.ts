import { DomainEvent } from '../../common/DomainEvent.js';
import { EntrySnapshot } from '../EntrySnapshot.js';

export class EntryRegisteredEvent implements DomainEvent {
  readonly type = 'entry.registered';

  constructor(
    public readonly entry: EntrySnapshot,
    public readonly occurredAt: Date,
  ) {}
}
