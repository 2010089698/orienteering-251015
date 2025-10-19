import { Entry, EntryRepository, EntrySnapshot } from '@entry-management/domain';
import { EntryReadRepository } from '@entry-management/application';

export type InMemoryEntryRepositoryStore = Map<string, EntrySnapshot>;

export const createInMemoryEntryRepositoryStore = (): InMemoryEntryRepositoryStore =>
  new Map<string, EntrySnapshot>();

export class InMemoryEntryRepository implements EntryRepository {
  constructor(private readonly entries: InMemoryEntryRepositoryStore = createInMemoryEntryRepositoryStore()) {}

  async save(entry: Entry): Promise<void> {
    this.entries.set(entry.id.toString(), entry.toSnapshot());
  }

  async findById(id: Entry['id']): Promise<Entry | null> {
    const snapshot = this.entries.get(id.toString());
    return snapshot ? Entry.rehydrate(snapshot) : null;
  }

  async findAll(): Promise<Entry[]> {
    return Array.from(this.entries.values()).map((snapshot) => Entry.rehydrate(snapshot));
  }

  async delete(id: Entry['id']): Promise<void> {
    this.entries.delete(id.toString());
  }

  get store(): InMemoryEntryRepositoryStore {
    return this.entries;
  }
}

export class InMemoryEntryReadRepository implements EntryReadRepository {
  constructor(private readonly entries: InMemoryEntryRepositoryStore) {}

  async findById(id: string): Promise<EntrySnapshot | null> {
    return this.entries.get(id) ?? null;
  }

  async findAll(): Promise<EntrySnapshot[]> {
    return Array.from(this.entries.values());
  }
}
