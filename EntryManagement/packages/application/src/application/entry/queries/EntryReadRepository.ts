import { EntrySnapshot } from '@entry-management/domain';

export interface EntryReadRepository {
  findAll(): Promise<EntrySnapshot[]>;
  findById(id: string): Promise<EntrySnapshot | null>;
}
