import { Entry } from '@entry-management/domain';
import { EntryDto, EntrySummaryDto } from './EntryDtos.js';

export const toEntryDto = (entry: Entry): EntryDto => ({
  id: entry.id.toString(),
  name: entry.name,
  classId: entry.classId,
  cardNumber: entry.cardNumber,
  club: entry.club,
  iofId: entry.iofId,
  createdAt: entry.createdAt.toISOString(),
});

export const toEntrySummaryDto = (entry: Entry): EntrySummaryDto => ({
  id: entry.id.toString(),
  name: entry.name,
  classId: entry.classId,
  cardNumber: entry.cardNumber,
  club: entry.club,
  iofId: entry.iofId,
});
