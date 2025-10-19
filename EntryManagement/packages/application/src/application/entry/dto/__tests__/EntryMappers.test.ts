import { describe, expect, it } from 'vitest';
import {
  Entry,
  EntryCardNumber,
  EntryClassId,
  EntryId,
  EntryName,
} from '@entry-management/domain';
import { toEntryDto, toEntrySummaryDto } from '../EntryMappers.js';

const baseEntry = () =>
  Entry.register({
    id: EntryId.create('entry-1'),
    name: EntryName.create('Alice Runner'),
    classId: EntryClassId.create('W21'),
    cardNumber: EntryCardNumber.create('123456'),
    club: 'Forest Club',
    iofId: 'IOF-123',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  });

describe('EntryMappers', () => {
  it('maps an entry to a DTO with primitive values', () => {
    const entry = baseEntry();

    expect(toEntryDto(entry)).toEqual({
      id: 'entry-1',
      name: 'Alice Runner',
      classId: 'W21',
      cardNumber: '123456',
      club: 'Forest Club',
      iofId: 'IOF-123',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('maps an entry to a summary DTO with primitive values', () => {
    const entry = baseEntry();

    expect(toEntrySummaryDto(entry)).toEqual({
      id: 'entry-1',
      name: 'Alice Runner',
      classId: 'W21',
      cardNumber: '123456',
      club: 'Forest Club',
      iofId: 'IOF-123',
    });
  });

  it('omits optional values that are undefined', () => {
    const entry = Entry.register({
      id: EntryId.create('entry-2'),
      name: EntryName.create('Bob Runner'),
      classId: EntryClassId.create('M21'),
      cardNumber: EntryCardNumber.create('654321'),
      createdAt: new Date('2024-01-02T00:00:00Z'),
    });

    expect(toEntryDto(entry)).toEqual({
      id: 'entry-2',
      name: 'Bob Runner',
      classId: 'M21',
      cardNumber: '654321',
      club: undefined,
      iofId: undefined,
      createdAt: '2024-01-02T00:00:00.000Z',
    });
    expect(toEntrySummaryDto(entry)).toEqual({
      id: 'entry-2',
      name: 'Bob Runner',
      classId: 'M21',
      cardNumber: '654321',
      club: undefined,
      iofId: undefined,
    });
  });

  it('maps a snapshot to DTOs', () => {
    const snapshot = baseEntry().toSnapshot();

    expect(toEntryDto(snapshot)).toEqual({
      id: 'entry-1',
      name: 'Alice Runner',
      classId: 'W21',
      cardNumber: '123456',
      club: 'Forest Club',
      iofId: 'IOF-123',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    expect(toEntrySummaryDto(snapshot)).toEqual({
      id: 'entry-1',
      name: 'Alice Runner',
      classId: 'W21',
      cardNumber: '123456',
      club: 'Forest Club',
      iofId: 'IOF-123',
    });
  });
});
