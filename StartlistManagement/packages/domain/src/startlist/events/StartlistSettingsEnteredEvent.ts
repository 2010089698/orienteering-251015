import { DomainEvent } from '../../common/DomainEvent.js';
import { StartlistSettingsDto } from '../StartlistDtos.js';

export class StartlistSettingsEnteredEvent implements DomainEvent {
  readonly type = 'StartlistSettingsEnteredEvent';
  public readonly occurredAt: Date;

  constructor(
    public readonly startlistId: string,
    public readonly settings: StartlistSettingsDto,
    occurredAt: Date,
  ) {
    this.occurredAt = new Date(occurredAt.getTime());
    this.settings = {
      eventId: settings.eventId,
      startTime: settings.startTime,
      laneCount: settings.laneCount,
      intervals: {
        laneClass: { milliseconds: settings.intervals.laneClass.milliseconds },
        classPlayer: { milliseconds: settings.intervals.classPlayer.milliseconds },
      },
    };
  }
}
