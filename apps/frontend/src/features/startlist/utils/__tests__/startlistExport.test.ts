import { describe, expect, it } from 'vitest';
import type { ClassAssignmentDto, StartTimeDto } from '@startlist-management/application';
import { RENTAL_CARD_LABEL, type Entry } from '../../state/types';
import { buildStartlistExportRows, exportRowToCsvLine } from '../startlistExport';

const createStartTime = (playerId: string, startTime: StartTimeDto['startTime']): StartTimeDto => ({
  playerId,
  startTime,
  laneNumber: 1,
});

const createAssignment = (classId: string, playerOrder: string[]): ClassAssignmentDto => ({
  classId,
  playerOrder,
  interval: { milliseconds: 60000 },
});

describe('buildStartlistExportRows', () => {
  it('sorts valid start times ascending and places invalid times last', () => {
    const entries: Entry[] = [
      { id: 'p1', name: 'Alice', classId: 'M21', cardNo: '1001', club: 'Alpha' },
      { id: 'p2', name: 'Bob', classId: 'M21', cardNo: '1002', club: 'Beta' },
      { id: 'p3', name: 'Charlie', classId: 'M21', cardNo: '1003', club: 'Gamma' },
    ];
    const startTimes: StartTimeDto[] = [
      createStartTime('p2', '2024-05-01T01:00:00Z'),
      createStartTime('p1', '2024-05-01T00:30:00Z'),
      createStartTime('p3', 'not-a-date'),
    ];
    const classAssignments = [createAssignment('M21', ['p1', 'p2', 'p3'])];

    const rows = buildStartlistExportRows({ entries, startTimes, classAssignments });

    expect(rows.map((row) => row.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('applies consistent start number padding based on the offset', () => {
    const entries: Entry[] = [
      { id: 'p1', name: 'Alice', classId: 'M21', cardNo: '1001', club: 'Alpha' },
      { id: 'p2', name: 'Bob', classId: 'M21', cardNo: '1002', club: 'Beta' },
      { id: 'p3', name: 'Charlie', classId: 'M21', cardNo: '1003', club: 'Gamma' },
    ];
    const startTimes: StartTimeDto[] = [
      createStartTime('p1', '2024-05-01T00:30:00Z'),
      createStartTime('p2', '2024-05-01T01:00:00Z'),
      createStartTime('p3', '2024-05-01T01:30:00Z'),
    ];
    const classAssignments = [createAssignment('M21', ['p1', 'p2', 'p3'])];

    const rows = buildStartlistExportRows({
      entries,
      startTimes,
      classAssignments,
      startNumberOffset: 8,
    });

    expect(rows.map((row) => row.startNumber)).toEqual(['008', '009', '010']);
  });

  it('replaces rental card numbers with an empty string', () => {
    const entries: Entry[] = [
      { id: 'p4', name: 'Rental Runner', classId: 'W21', cardNo: RENTAL_CARD_LABEL, club: 'Delta' },
    ];
    const startTimes = [createStartTime('p4', '2024-05-01T03:00:00Z')];
    const classAssignments = [createAssignment('W21', ['p4'])];

    const [row] = buildStartlistExportRows({ entries, startTimes, classAssignments });

    expect(row.cardNo).toBe('');
  });

  it('throws when the start number exceeds five digits', () => {
    const entries: Entry[] = [{ id: 'p5', name: 'Overflow', classId: 'M35', cardNo: '2000', club: '' }];
    const startTimes = [createStartTime('p5', '2024-05-01T05:00:00Z')];
    const classAssignments = [createAssignment('M35', ['p5'])];

    expect(() =>
      buildStartlistExportRows({
        entries,
        startTimes,
        classAssignments,
        startNumberOffset: 100000,
      }),
    ).toThrowError('start number range exceeded');
  });
});

describe('exportRowToCsvLine', () => {
  it('quotes fields containing commas or quotes', () => {
    const line = exportRowToCsvLine({
      classId: 'M21',
      startNumber: '001',
      name: 'Alice "Fast" Runner',
      club: 'Club,Team',
      cardNo: '',
    });

    expect(line).toBe('M21,001,"Alice ""Fast"" Runner","Club,Team",');
  });
});
