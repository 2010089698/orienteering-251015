import { DomainClock } from '../common/DomainClock';
import { Startlist } from './Startlist';
import { StartlistId } from './StartlistId';

export class StartlistFactory {
  constructor(private readonly clock: DomainClock) {}

  create(id: StartlistId): Startlist {
    return Startlist.createNew(id, this.clock);
  }
}
