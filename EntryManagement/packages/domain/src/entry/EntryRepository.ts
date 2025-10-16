import { Entry } from './Entry.js';
import { EntryId } from './EntryId.js';

export interface EntryRepository {
  save(entry: Entry): Promise<void>;
  findById(id: EntryId): Promise<Entry | null>;
  findAll(): Promise<Entry[]>;
  delete(id: EntryId): Promise<void>;
}
