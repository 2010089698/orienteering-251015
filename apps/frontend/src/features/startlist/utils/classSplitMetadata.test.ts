import { describe, expect, it } from 'vitest';
import { buildClassSplitMetadata } from './classSplitMetadata';

describe('buildClassSplitMetadata', () => {
  it('returns metadata and counts for split classes', () => {
    const { metadataByClassId, countsByClassId } = buildClassSplitMetadata({
      entries: [
        { id: '1', name: 'A', classId: 'M21', cardNo: '1' },
        { id: '2', name: 'B', classId: 'M21', cardNo: '2' },
        { id: '3', name: 'C', classId: 'M21', cardNo: '3' },
        { id: '4', name: 'D', classId: 'W21', cardNo: '4' },
      ],
      laneAssignments: [
        { laneNumber: 1, classOrder: ['M21-A', 'W21'], interval: { milliseconds: 60000 } },
        { laneNumber: 2, classOrder: ['M21-B'], interval: { milliseconds: 60000 } },
      ],
      splitClasses: [
        { classId: 'M21-A', baseClassId: 'M21', splitIndex: 0, displayName: 'A' },
        { classId: 'M21-B', baseClassId: 'M21', splitIndex: 1, displayName: 'B' },
      ],
      splitIdToEntryIds: new Map([
        ['M21-A', ['1', '2']],
        ['M21-B', ['3']],
        ['M21', ['1', '2', '3']],
        ['W21', ['4']],
      ]),
    });

    expect(metadataByClassId.get('M21-A')).toMatchObject({
      baseClassId: 'M21',
      splitIndex: 0,
      partCount: 2,
      displayName: 'A',
      helperText: 'M21 • 分割 A (1/2)',
    });
    expect(countsByClassId.get('M21-A')).toBe(2);
    expect(metadataByClassId.get('M21')).toMatchObject({ baseClassId: 'M21', partCount: 2 });
    expect(countsByClassId.get('M21')).toBe(3);
    expect(metadataByClassId.get('W21')).toMatchObject({ baseClassId: 'W21', partCount: 1 });
    expect(countsByClassId.get('W21')).toBe(1);
  });

  it('falls back to entry counts and lane assignments when split data is missing', () => {
    const { metadataByClassId, countsByClassId } = buildClassSplitMetadata({
      entries: [{ id: '10', name: 'Open Runner', classId: 'Open', cardNo: '10' }],
      laneAssignments: [
        { laneNumber: 1, classOrder: ['Open', 'Guest'], interval: { milliseconds: 0 } },
      ],
    });

    expect(metadataByClassId.get('Open')).toMatchObject({ baseClassId: 'Open', partCount: 1 });
    expect(countsByClassId.get('Open')).toBe(1);
    expect(metadataByClassId.get('Guest')).toMatchObject({ baseClassId: 'Guest', partCount: 1 });
    expect(countsByClassId.get('Guest')).toBe(0);
  });

  it('uses provided base class mapping without split metadata', () => {
    const { metadataByClassId } = buildClassSplitMetadata({
      entries: [],
      laneAssignments: [{ laneNumber: 1, classOrder: ['X-1'], interval: { milliseconds: 0 } }],
      splitIdToBaseClassId: new Map([
        ['X-1', 'X'],
        ['X', 'X'],
      ]),
    });

    expect(metadataByClassId.get('X-1')).toMatchObject({ baseClassId: 'X', partCount: 1 });
  });
});
