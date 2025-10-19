import { Entry, EntrySnapshot } from '@entry-management/domain';
import { EntryDto, EntrySummaryDto } from './EntryDtos.js';

type EntryLike = Entry | EntrySnapshot;

const toSnapshot = (entry: EntryLike): EntrySnapshot =>
  entry instanceof Entry ? entry.toSnapshot() : entry;

export const toEntryDto = (entry: EntryLike): EntryDto => {
  const snapshot = toSnapshot(entry);

  return {
    id: snapshot.id,
    name: snapshot.name,
    classId: snapshot.classId,
    cardNumber: snapshot.cardNumber,
    club: snapshot.club,
    iofId: snapshot.iofId,
    createdAt: snapshot.createdAt,
  };
};

export const toEntrySummaryDto = (entry: EntryLike): EntrySummaryDto => {
  const snapshot = toSnapshot(entry);

  return {
    id: snapshot.id,
    name: snapshot.name,
    classId: snapshot.classId,
    cardNumber: snapshot.cardNumber,
    club: snapshot.club,
    iofId: snapshot.iofId,
  };
};
