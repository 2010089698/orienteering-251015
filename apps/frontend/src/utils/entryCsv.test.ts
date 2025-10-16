import { describe, expect, it } from 'vitest';
import type { Entry } from '../state/types';
import { parseEntriesFromCsvFile, parseEntriesFromCsvText } from './entryCsv';

const existingEntries: Entry[] = [
  { name: 'Existing', club: 'Club', classId: 'M21E', cardNo: '999' },
];

describe('parseEntriesFromCsvText', () => {
  it('parses entries and normalizes whitespace', () => {
    const csv = 'name,club,class,card number\n  Alice  ,  Tokyo  , M21E ,  123  \n"Bob",,"F21", "456"\n';

    const result = parseEntriesFromCsvText(csv, existingEntries);

    expect(result).toEqual([
      { name: 'Alice', club: 'Tokyo', classId: 'M21E', cardNo: '123' },
      { name: 'Bob', club: '', classId: 'F21', cardNo: '456' },
    ]);
  });

  it('throws when required headers are missing', () => {
    const csv = 'name,club,card\nAlice,Tokyo,123\n';

    expect(() => parseEntriesFromCsvText(csv, existingEntries)).toThrow(
      'CSV ファイルに必須列 (name, class, card number) が含まれていません。',
    );
  });

  it('throws when required fields are empty', () => {
    const csv = 'name,club,class,card number\n,,M21,123\n';

    expect(() => parseEntriesFromCsvText(csv, existingEntries)).toThrow(
      'CSV 2 行目で必須項目 name が空です。',
    );
  });

  it('throws when duplicates exist within the CSV', () => {
    const csv = 'name,club,class,card number\nAlice,,M21,123\nBob,,M21,123\n';

    expect(() => parseEntriesFromCsvText(csv, existingEntries)).toThrow(
      'CSV 内に重複したカード番号 123 が含まれています。',
    );
  });

  it('throws when duplicates exist with existing entries', () => {
    const csv = 'name,club,class,card number\nAlice,,M21,999\n';

    expect(() => parseEntriesFromCsvText(csv, existingEntries)).toThrow(
      'カード番号 999 はすでに登録されています。',
    );
  });

  it('parses entries when reading from a File object', async () => {
    const file = new File(
      ['name,club,class,card number\nAlice,Tokyo,M21,123\n'],
      'entries.csv',
      { type: 'text/csv' },
    );

    await expect(parseEntriesFromCsvFile(file, [])).resolves.toEqual([
      { name: 'Alice', club: 'Tokyo', classId: 'M21', cardNo: '123' },
    ]);
  });
});
