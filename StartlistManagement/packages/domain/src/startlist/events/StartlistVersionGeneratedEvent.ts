import { DomainEvent } from '../../common/DomainEvent.js';
import { cloneStartlistSnapshotDto } from '../StartlistDtos.js';
import { StartlistSnapshot } from '../StartlistSnapshot.js';

export class StartlistVersionGeneratedEvent implements DomainEvent {
  readonly type = 'StartlistVersionGeneratedEvent';
  public readonly startlistId: string;
  public readonly snapshot: StartlistSnapshot;
  public readonly confirmedAt: Date;

  constructor(startlistId: string, snapshot: StartlistSnapshot, confirmedAt: Date) {
    this.startlistId = startlistId;
    this.snapshot = cloneStartlistSnapshotDto(snapshot);
    this.confirmedAt = new Date(confirmedAt.getTime());
  }
}
