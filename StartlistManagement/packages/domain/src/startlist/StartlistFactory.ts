import { DomainClock } from '../common/DomainClock.js';
import { Startlist, StartlistMetadata } from './Startlist.js';
import { StartlistId } from './StartlistId.js';

export class StartlistFactory {
  constructor(private readonly clock: DomainClock) {}

  create(id: StartlistId, metadata: StartlistMetadata): Startlist {
    return Startlist.createNew(id, this.clock, metadata);
  }
}
