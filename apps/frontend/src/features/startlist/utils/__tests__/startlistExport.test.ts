import { describe, expect, it, vi } from 'vitest';
import type { ClassAssignmentDto, StartTimeDto } from '@startlist-management/application';
import { RENTAL_CARD_LABEL, type Entry } from '../../state/types';
import { buildStartlistExportRows, downloadStartlistCsv, exportRowToCsvLine } from '../startlistExport';

const createStartTime = (
  playerId: string,
  startTime: StartTimeDto['startTime'],
  laneNumber: number = 1,
): StartTimeDto => ({
  playerId,
  startTime,
  laneNumber,
});

const createAssignment = (classId: string, playerOrder: string[]): ClassAssignmentDto => ({
  classId,
  playerOrder,
  interval: { milliseconds: 60000 },
});

describe('buildStartlistExportRows', () => {
  it('sorts by lane and start time while placing invalid times last', () => {
    const entries: Entry[] = [
      { id: 'p1', name: 'Lane1 Early', classId: 'M21', cardNo: '1001', club: 'Alpha' },
      { id: 'p2', name: 'Lane2 Late', classId: 'M21', cardNo: '1002', club: 'Beta' },
      { id: 'p3', name: 'Lane2 Early', classId: 'M21', cardNo: '1003', club: 'Gamma' },
      { id: 'p4', name: 'Lane1 Invalid', classId: 'M21', cardNo: '1004', club: 'Delta' },
    ];
    const startTimes: StartTimeDto[] = [
      createStartTime('p2', '2024-05-01T09:30:00+09:00', 2),
      createStartTime('p1', '2024-05-01T09:00:00+09:00', 1),
      createStartTime('p3', '2024-05-01T09:15:00+09:00', 2),
      createStartTime('p4', 'not-a-date', 1),
    ];
    const classAssignments = [createAssignment('M21', ['p1', 'p2', 'p3', 'p4'])];

    const rows = buildStartlistExportRows({ entries, startTimes, classAssignments });

    expect(rows.map((row) => row.name)).toEqual([
      'Lane1 Early',
      'Lane2 Early',
      'Lane2 Late',
      'Lane1 Invalid',
    ]);
  });

  it('assigns start numbers per lane using the offset for the three-digit sequence', () => {
    const entries: Entry[] = [
      { id: 'p1', name: 'Lane1 A', classId: 'M21', cardNo: '1001', club: 'Alpha' },
      { id: 'p2', name: 'Lane1 B', classId: 'M21', cardNo: '1002', club: 'Beta' },
      { id: 'p3', name: 'Lane2 A', classId: 'M21', cardNo: '1003', club: 'Gamma' },
    ];
    const startTimes: StartTimeDto[] = [
      createStartTime('p1', '2024-05-01T09:00:00+09:00', 1),
      createStartTime('p2', '2024-05-01T10:00:00+09:00', 1),
      createStartTime('p3', '2024-05-01T09:30:00+09:00', 2),
    ];
    const classAssignments = [createAssignment('M21', ['p1', 'p2', 'p3'])];

    const rows = buildStartlistExportRows({
      entries,
      startTimes,
      classAssignments,
      startNumberOffset: 5,
    });

    expect(rows.map((row) => row.startNumber)).toEqual(['1005', '1006', '2005']);
  });

  it('formats start times with seconds only when the class interval is 30 seconds', () => {
    const entries: Entry[] = [
      { id: 'p1', name: 'Minute Interval', classId: 'M21', cardNo: '1001', club: 'Alpha' },
      { id: 'p2', name: 'Second Interval', classId: 'W21', cardNo: '1002', club: 'Beta' },
    ];
    const startTimes: StartTimeDto[] = [
      createStartTime('p1', '2024-05-01T09:00:00+09:00', 1),
      createStartTime('p2', '2024-05-01T09:00:30+09:00', 2),
    ];
    const classAssignments = [
      createAssignment('M21', ['p1']),
      { classId: 'W21', playerOrder: ['p2'], interval: { milliseconds: 30_000 } },
    ];

    const rows = buildStartlistExportRows({ entries, startTimes, classAssignments });

    expect(rows.map((row) => row.startTimeLabel)).toEqual(['09:00', '09:00:30']);
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

  it('uses split class IDs from assignments while retaining base class formatting', () => {
    const entries: Entry[] = [
      { id: 'sp1', name: 'Split Alpha', classId: 'SP', cardNo: '2001', club: 'Alpha' },
      { id: 'sp2', name: 'Split Beta', classId: 'SP', cardNo: '2002', club: 'Beta' },
    ];
    const startTimes = [
      createStartTime('sp1', '2024-05-01T09:00:00+09:00', 1),
      createStartTime('sp2', '2024-05-01T09:01:00+09:00', 1),
    ];
    const classAssignments = [
      { classId: 'SP1', playerOrder: ['sp1'], interval: { milliseconds: 60000 } },
      { classId: 'SP2', playerOrder: ['sp2'], interval: { milliseconds: 60000 } },
    ];

    const rows = buildStartlistExportRows({ entries, startTimes, classAssignments });

    expect(rows.map((row) => row.classId)).toEqual(['SP1', 'SP2']);
    expect(rows.map((row) => row.startTimeLabel)).toEqual(['09:00', '09:01']);
  });

  it('throws when the start number sequence exceeds three digits', () => {
    const entries: Entry[] = [{ id: 'p5', name: 'Overflow', classId: 'M35', cardNo: '2000', club: '' }];
    const startTimes = [createStartTime('p5', '2024-05-01T05:00:00Z')];
    const classAssignments = [createAssignment('M35', ['p5'])];

    expect(() =>
      buildStartlistExportRows({
        entries,
        startTimes,
        classAssignments,
        startNumberOffset: 1000,
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
      startTimeLabel: '2024-05-01T00:30:00Z',
      cardNo: '',
    });

    expect(line).toBe('M21,001,"Alice ""Fast"" Runner","Club,Team",2024-05-01T00:30:00Z,');
  });
});

describe('downloadStartlistCsv', () => {
  const baseEntries: Entry[] = [
    { id: 'p1', name: 'Alice', classId: 'M21', cardNo: '1001', club: 'Alpha' },
    { id: 'p2', name: 'Bob', classId: 'M21', cardNo: '1002', club: 'Beta' },
  ];
  const baseStartTimes: StartTimeDto[] = [
    createStartTime('p1', '2024-05-01T09:30:00+09:00', 1),
    createStartTime('p2', '2024-05-01T10:00:00+09:00', 2),
  ];
  const baseAssignments = [createAssignment('M21', ['p1', 'p2'])];

  it('creates a Blob URL and triggers anchor click', async () => {
    const createdBlobs: Blob[] = [];
    const originalBlob = globalThis.Blob;
    class RecordingBlob {
      public readonly rawContent: string;
      private readonly content: string;
      public readonly type: string;
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        this.content = parts
          .map((part) => (typeof part === 'string' ? part : String(part)))
          .join('');
        this.rawContent = this.content;
        this.type = options?.type ?? '';
      }
      get size(): number {
        return new TextEncoder().encode(this.content).length;
      }
      async arrayBuffer(): Promise<ArrayBuffer> {
        return new TextEncoder().encode(this.content).buffer;
      }
      async text(): Promise<string> {
        return this.content;
      }
    }
    (globalThis as unknown as { Blob: typeof Blob }).Blob = RecordingBlob as unknown as typeof Blob;
    const createObjectURLMock = vi.fn((blob: Blob) => {
      createdBlobs.push(blob);
      return 'blob:mock';
    });
    const revokeObjectURLMock = vi.fn();
    const clickMock = vi.fn();
    const removeMock = vi.fn(function (this: { isConnected: boolean }) {
      this.isConnected = false;
    });

    const link = {
      href: '',
      download: '',
      style: { display: '' },
      click: clickMock,
      remove: removeMock,
      isConnected: false,
    } as unknown as HTMLAnchorElement & { isConnected: boolean };

    const appendChildMock = vi.fn(() => {
      link.isConnected = true;
    });

    const docMock = {
      createElement: vi.fn(() => link),
      body: {
        appendChild: appendChildMock,
      },
    } as unknown as Document;

    try {
      const count = downloadStartlistCsv({
        entries: baseEntries,
        startTimes: baseStartTimes,
        classAssignments: baseAssignments,
        fileNamePrefix: 'custom',
        context: {
          document: docMock,
          createObjectURL: createObjectURLMock,
          revokeObjectURL: revokeObjectURLMock,
        },
      });

      expect(count).toBe(2);
      expect(docMock.createElement).toHaveBeenCalledWith('a');
      expect(appendChildMock).toHaveBeenCalledWith(link);
      expect(clickMock).toHaveBeenCalledTimes(1);
      expect(removeMock).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock');
      expect(link.download).toMatch(/^custom-\d{8}\.csv$/);
      expect(createdBlobs).toHaveLength(1);

      const rawContent = (createdBlobs[0] as unknown as { rawContent: string }).rawContent;
      expect(rawContent.charCodeAt(0)).toBe(0xfeff);

      const csvArrayBuffer = await createdBlobs[0].arrayBuffer();
      const csvText = new TextDecoder('utf-8').decode(csvArrayBuffer);
      expect(csvText).toContain('クラス,スタート番号,氏名,所属,スタート時刻,カード番号');
      expect(csvText).toContain('M21,1001,Alice,Alpha,09:30');
    } finally {
      (globalThis as unknown as { Blob: typeof Blob }).Blob = originalBlob;
    }
  });

  it('throws when start times are missing', () => {
    expect(() =>
      downloadStartlistCsv({
        entries: baseEntries,
        startTimes: [],
        classAssignments: baseAssignments,
      }),
    ).toThrowError('スタート時間が存在しません。');
  });
});
