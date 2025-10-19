import {
  DomainClock,
  SystemClock,
  Startlist,
  StartlistId,
  StartlistRepository,
  StartlistSnapshot,
  cloneStartlistSnapshotDto,
} from '@startlist-management/domain';

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
      snapshot: cloneStartlistSnapshotDto(snapshot),
    });
  }

  async save(startlist: Startlist): Promise<void> {
    const snapshot = cloneStartlistSnapshotDto(startlist.toSnapshot());
    this.store.set(startlist.getId().toString(), snapshot);
  }

  clear(): void {
    this.store.clear();
  }
}
