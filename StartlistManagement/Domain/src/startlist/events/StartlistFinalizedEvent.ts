import { DomainEvent } from '../../common/DomainEvent';
import { StartlistSnapshot } from '../StartlistSnapshot';

export class StartlistFinalizedEvent implements DomainEvent {
  readonly type = 'StartlistFinalizedEvent';
  public readonly occurredAt: Date;

  constructor(
    public readonly startlistId: string,
    public readonly finalStartlist: StartlistSnapshot,
    occurredAt: Date,
  ) {
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
