import { StartlistId, StartlistSnapshot, cloneStartlistSnapshotDto } from '@startlist-management/domain';
import { StartlistReadRepository } from '@startlist-management/application';

export class InMemoryStartlistReadRepository implements StartlistReadRepository {
  constructor(private readonly store: Map<string, StartlistSnapshot> = new Map()) {}

  async findById(id: StartlistId): Promise<StartlistSnapshot | undefined> {
    const snapshot = this.store.get(id.toString());
    if (!snapshot) {
      return undefined;
    }
    return cloneStartlistSnapshotDto(snapshot);
  }
}
