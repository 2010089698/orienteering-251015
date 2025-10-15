import { DomainClock, SystemClock } from '../../../Domain/src/common/DomainClock.js';
import { Startlist } from '../../../Domain/src/startlist/Startlist.js';
import { StartlistId } from '../../../Domain/src/startlist/StartlistId.js';
import { StartlistRepository } from '../../../Domain/src/startlist/StartlistRepository.js';
import { StartlistSnapshot } from '../../../Domain/src/startlist/StartlistSnapshot.js';

const cloneSnapshot = (snapshot: StartlistSnapshot): StartlistSnapshot => ({
  ...snapshot,
  laneAssignments: [...snapshot.laneAssignments],
  classAssignments: [...snapshot.classAssignments],
  startTimes: [...snapshot.startTimes],
});

export class InMemoryStartlistRepository implements StartlistRepository {
  private readonly store = new Map<string, StartlistSnapshot>();

  constructor(private readonly clock: DomainClock = SystemClock) {}

  async findById(id: StartlistId): Promise<Startlist | undefined> {
    const snapshot = this.store.get(id.toString());
    if (!snapshot) {
      return undefined;
    }
    return Startlist.reconstitute({
      id,
      clock: this.clock,
      settings: snapshot.settings,
      laneAssignments: [...snapshot.laneAssignments],
      classAssignments: [...snapshot.classAssignments],
      startTimes: [...snapshot.startTimes],
      status: snapshot.status,
    });
  }

  async save(startlist: Startlist): Promise<void> {
    const snapshot = cloneSnapshot(startlist.toSnapshot());
    this.store.set(startlist.getId().toString(), snapshot);
  }

  clear(): void {
    this.store.clear();
  }
}
