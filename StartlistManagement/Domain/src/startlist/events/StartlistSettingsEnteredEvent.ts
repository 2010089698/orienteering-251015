import { DomainEvent } from '../../common/DomainEvent';
import { StartlistSettings } from '../StartlistSettings';

export class StartlistSettingsEnteredEvent implements DomainEvent {
  readonly type = 'StartlistSettingsEnteredEvent';

  constructor(
    public readonly startlistId: string,
    public readonly settings: StartlistSettings,
    public readonly occurredAt: Date,
  ) {}
}
