import { DomainEvent } from '../../common/DomainEvent.js';
import { StartlistSnapshot } from '../StartlistSnapshot.js';
import { cloneStartlistSnapshotDto } from '../StartlistDtos.js';

export class StartlistFinalizedEvent implements DomainEvent {
  readonly type = 'StartlistFinalizedEvent';
  public readonly occurredAt: Date;
  public readonly startlistId: string;
  public readonly finalStartlist: StartlistSnapshot;

  constructor(startlistId: string, finalStartlist: StartlistSnapshot, occurredAt: Date) {
    this.startlistId = startlistId;
    this.finalStartlist = cloneStartlistSnapshotDto(finalStartlist);
    this.occurredAt = new Date(occurredAt.getTime());
  }
}
