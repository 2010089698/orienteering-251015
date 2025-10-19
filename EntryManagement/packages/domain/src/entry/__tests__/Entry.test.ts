import { describe, expect, it } from 'vitest';
import { Entry } from '../Entry.js';
import { EntryId } from '../EntryId.js';
import { EntryName } from '../EntryName.js';
import { EntryClassId } from '../EntryClassId.js';
import { EntryCardNumber } from '../EntryCardNumber.js';

describe('Entry.register', () => {
  const baseProps = {
    id: EntryId.create('entry-1'),
    name: EntryName.create('Alice Runner'),
    classId: EntryClassId.create('W21'),
    cardNumber: EntryCardNumber.create('123456'),
    club: 'Forest Club',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  } as const;

  it('keeps the IOF ID when provided', () => {
    const entry = Entry.register({ ...baseProps, iofId: 'IOF-123' });

    expect(entry.iofId).toBe('IOF-123');
    expect(entry.toSnapshot().iofId).toBe('IOF-123');

    const rehydrated = Entry.rehydrate(entry.toSnapshot());
    expect(rehydrated.iofId).toBe('IOF-123');
  });

  it('leaves the IOF ID undefined when it is not provided', () => {
    const entry = Entry.register(baseProps);

    expect(entry.iofId).toBeUndefined();
    expect(entry.toSnapshot()).not.toHaveProperty('iofId');

    const rehydrated = Entry.rehydrate(entry.toSnapshot());
    expect(rehydrated.iofId).toBeUndefined();
  });
});
