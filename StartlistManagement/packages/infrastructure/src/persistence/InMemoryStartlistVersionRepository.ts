import {
  StartlistId,
  StartlistVersion,
  StartlistVersionRepository,
  SaveStartlistVersionParams,
  cloneStartlistSnapshotDto,
  cloneStartlistVersion,
} from '@startlist-management/domain';

export interface InMemoryStartlistVersionRepositoryDependencies {
  store?: Map<string, StartlistVersion[]>;
}

export class InMemoryStartlistVersionRepository implements StartlistVersionRepository {
  private readonly store: Map<string, StartlistVersion[]>;

  constructor({ store = new Map<string, StartlistVersion[]>() }: InMemoryStartlistVersionRepositoryDependencies = {}) {
    this.store = store;
  }

  async saveVersion(params: SaveStartlistVersionParams): Promise<StartlistVersion> {
    const { startlistId, snapshot, confirmedAt } = params;
    const key = startlistId.toString();
    const history = this.store.get(key) ?? [];
    const nextVersionNumber = history.length + 1;

    const version: StartlistVersion = {
      version: nextVersionNumber,
      snapshot: cloneStartlistSnapshotDto(snapshot),
      confirmedAt: new Date(confirmedAt.getTime()),
    };

    if (!this.store.has(key)) {
      this.store.set(key, history);
    }

    history.push(version);

    return cloneStartlistVersion(version);
  }

  async findVersions(startlistId: StartlistId): Promise<StartlistVersion[]> {
    const versions = this.store.get(startlistId.toString()) ?? [];
    return versions.map(cloneStartlistVersion);
  }

  clear(): void {
    this.store.clear();
  }
}
