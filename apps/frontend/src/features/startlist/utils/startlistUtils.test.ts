import { describe, expect, it } from 'vitest';
import type { Entry } from '../state/types';
import {
  calculateStartTimes,
  createDefaultClassAssignments,
  generateLaneAssignments,
  groupEntriesByClass,
  reorderLaneClass,
  updateClassPlayerOrder,
} from './startlistUtils';

describe('groupEntriesByClass', () => {
  it('groups entries by classId trimming whitespace', () => {
    const entries: Entry[] = [
      { id: 'entry-1', name: 'A', club: 'X', classId: 'M21', cardNo: '1' },
      { id: 'entry-2', name: 'B', club: 'Y', classId: ' M21 ', cardNo: '2' },
      { id: 'entry-3', name: 'C', club: 'Z', classId: 'W21', cardNo: '3' },
    ];

    const result = groupEntriesByClass(entries);

    expect(Array.from(result.keys())).toEqual(['M21', 'W21']);
    expect(result.get('M21')).toHaveLength(2);
  });
});

describe('generateLaneAssignments', () => {
  const entries: Entry[] = [
    { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '1' },
    { id: 'entry-2', name: 'B', classId: 'M21', cardNo: '2' },
    { id: 'entry-3', name: 'C', classId: 'W21', cardNo: '3' },
    { id: 'entry-4', name: 'D', classId: 'M18', cardNo: '4' },
  ];

  it('returns empty when lane count missing or interval negative', () => {
    expect(generateLaneAssignments(entries, 0, 60000)).toEqual([]);
    expect(generateLaneAssignments(entries, 2, -1)).toEqual([]);
  });

  it('keeps lane assignments when interval is zero', () => {
    const assignments = generateLaneAssignments(entries, 2, 0);

    expect(assignments).not.toHaveLength(0);
    expect(assignments.every((assignment) => assignment.interval.milliseconds === 0)).toBe(true);
  });

  it('distributes classes to lanes balancing load', () => {
    const assignments = generateLaneAssignments(entries, 2, 60000);

    expect(assignments).toHaveLength(2);
    expect(assignments[0].laneNumber).toBe(1);
    expect(assignments[0].classOrder).toContain('M21');
    const totalAssigned = assignments.reduce((sum, lane) => sum + lane.classOrder.length, 0);
    expect(totalAssigned).toBe(3);
  });
});

describe('reorderLaneClass', () => {
  it('only reorders classes within the targeted lane', () => {
    const assignments = [
      { laneNumber: 1, classOrder: ['A', 'B', 'C'], interval: { milliseconds: 1000 } },
      { laneNumber: 2, classOrder: ['D', 'E'], interval: { milliseconds: 1000 } },
    ];

    const updated = reorderLaneClass(assignments, 1, 0, 2);

    expect(updated[0].classOrder).toEqual(['B', 'C', 'A']);
    expect(updated[1].classOrder).toEqual(['D', 'E']);
  });
});

describe('updateClassPlayerOrder', () => {
  it('moves player within class assignment', () => {
    const assignments = [
      { classId: 'A', playerOrder: ['1', '2', '3'], interval: { milliseconds: 1000 } },
      { classId: 'B', playerOrder: ['4', '5'], interval: { milliseconds: 1000 } },
    ];

    const updated = updateClassPlayerOrder(assignments, 'A', 2, 0);

    expect(updated[0].playerOrder).toEqual(['3', '1', '2']);
    expect(updated[1].playerOrder).toEqual(['4', '5']);
  });
});

describe('calculateStartTimes', () => {
  const entries: Entry[] = [
    { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '1001' },
    { id: 'entry-2', name: 'B', classId: 'M21', cardNo: '1002' },
    { id: 'entry-3', name: 'C', classId: 'W21', cardNo: '2001' },
  ];

  it('returns empty when settings missing startTime or interval', () => {
    expect(
      calculateStartTimes({
        settings: undefined,
        laneAssignments: [],
        classAssignments: [],
        entries,
      }),
    ).toEqual([]);
  });

  it('calculates start times honoring lane and class assignments', () => {
    const laneAssignments = [
      { laneNumber: 1, classOrder: ['M21', 'W21'], interval: { milliseconds: 90000 } },
    ];
    const classAssignments = createDefaultClassAssignments(entries, 60000);
    const settings = {
      eventId: 'event',
      startTime: new Date('2024-01-01T09:00:00.000Z').toISOString(),
      intervals: {
        laneClass: { milliseconds: 90000 },
        classPlayer: { milliseconds: 60000 },
      },
      laneCount: 2,
    };

    const result = calculateStartTimes({ settings, laneAssignments, classAssignments, entries });

    expect(result).toHaveLength(3);
    const [first, second, third] = result;
    expect(result.map((item) => item.playerId)).toEqual(['entry-1', 'entry-2', 'entry-3']);
    expect(first.laneNumber).toBe(1);
    expect(new Date(first.startTime).toISOString()).toBe(settings.startTime);
    expect(new Date(second.startTime).toISOString()).toBe(
      new Date(new Date(settings.startTime).getTime() + 60000).toISOString(),
    );
    expect(new Date(third.startTime).toISOString()).toBe(
      new Date(new Date(settings.startTime).getTime() + 60000 * 2 + 90000).toISOString(),
    );
  });
});
