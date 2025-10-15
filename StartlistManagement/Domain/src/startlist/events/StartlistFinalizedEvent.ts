import { DomainEvent } from '../../common/DomainEvent';
import { StartlistSnapshot } from '../StartlistSnapshot';

export class StartlistFinalizedEvent implements DomainEvent {
  readonly type = 'StartlistFinalizedEvent';
  public readonly occurredAt: Date;
  public readonly startlistId: string;
  public readonly finalStartlist: StartlistSnapshot;

  constructor(startlistId: string, finalStartlist: StartlistSnapshot, occurredAt: Date) {
    this.startlistId = startlistId;
    this.finalStartlist = {
      ...finalStartlist,
      laneAssignments: [...finalStartlist.laneAssignments],
      classAssignments: [...finalStartlist.classAssignments],
      startTimes: [...finalStartlist.startTimes],
    };
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
