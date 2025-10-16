import { Entry, EntryRepository, EntrySnapshot } from '@entry-management/domain';

export class InMemoryEntryRepository implements EntryRepository {
  private readonly entries = new Map<string, EntrySnapshot>();

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
}
