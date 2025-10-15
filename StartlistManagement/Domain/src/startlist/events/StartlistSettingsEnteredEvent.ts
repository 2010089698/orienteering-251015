import { DomainEvent } from '../../common/DomainEvent';
import { StartlistSettings } from '../StartlistSettings';

export class StartlistSettingsEnteredEvent implements DomainEvent {
  readonly type = 'StartlistSettingsEnteredEvent';
  public readonly occurredAt: Date;

  constructor(
    public readonly startlistId: string,
    public readonly settings: StartlistSettings,
    occurredAt: Date,
  ) {
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
