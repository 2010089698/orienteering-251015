import { DomainEvent } from '../../common/DomainEvent';
import { StartlistSnapshot } from '../StartlistSnapshot';

export class StartlistFinalizedEvent implements DomainEvent {
  readonly type = 'StartlistFinalizedEvent';

  constructor(
    public readonly startlistId: string,
    public readonly finalStartlist: StartlistSnapshot,
    public readonly occurredAt: Date,
  ) {}
}
