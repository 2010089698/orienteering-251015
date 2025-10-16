import { EntryId, EntryRepository } from '@entry-management/domain';
import { EntryDto, EntrySummaryDto } from '../dto/EntryDtos.js';
import { toEntryDto, toEntrySummaryDto } from '../dto/EntryMappers.js';

export interface EntryQueryService {
  listEntries(): Promise<EntrySummaryDto[]>;
  getEntry(id: string): Promise<EntryDto | null>;
}

export class EntryQueryServiceImpl implements EntryQueryService {
  constructor(private readonly repository: EntryRepository) {}

  async listEntries(): Promise<EntrySummaryDto[]> {
    const entries = await this.repository.findAll();
    return entries.map(toEntrySummaryDto);
  }

  async getEntry(id: string): Promise<EntryDto | null> {
    const entry = await this.repository.findById(EntryId.create(id));
    return entry ? toEntryDto(entry) : null;
  }
}
