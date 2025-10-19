import { describe, expect, it } from 'vitest';
import type { Entry } from '../state/types';
import {
  calculateStartTimes,
  createDefaultClassAssignments,
  deriveClassOrderWarnings,
  generateLaneAssignments,
  groupEntriesByClass,
  prepareClassSplits,
  reorderLaneClass,
  updateClassPlayerOrder,
} from './startlistUtils';
import { seededRandomUnconstrainedClassOrderPolicy } from './classOrderPolicy';

const extractOrders = (assignments: ReturnType<typeof createDefaultClassAssignments>['assignments']) =>
  assignments.map((assignment) => ({ classId: assignment.classId, order: assignment.playerOrder }));

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
    expect(generateLaneAssignments(entries, 0, 60000).assignments).toEqual([]);
    expect(generateLaneAssignments(entries, 2, -1).assignments).toEqual([]);
  });

  it('keeps lane assignments when interval is zero', () => {
    const { assignments } = generateLaneAssignments(entries, 2, 0);

    expect(assignments).not.toHaveLength(0);
    expect(assignments.every((assignment) => assignment.interval.milliseconds === 0)).toBe(true);
  });

  it('distributes classes to lanes balancing load', () => {
    const { assignments } = generateLaneAssignments(entries, 2, 60000);

    expect(assignments).toHaveLength(2);
    expect(assignments[0].laneNumber).toBe(1);
    expect(assignments[0].classOrder).toContain('M21');
    const totalAssigned = assignments.reduce((sum, lane) => sum + lane.classOrder.length, 0);
    expect(totalAssigned).toBe(3);
  });
});

describe('prepareClassSplits', () => {
  it('creates split groups and metadata', () => {
    const entries: Entry[] = [
      { id: 'm21-1', name: 'Alpha', classId: 'M21', cardNo: '1' },
      { id: 'm21-2', name: 'Bravo', classId: 'M21', cardNo: '2' },
      { id: 'm21-3', name: 'Charlie', classId: 'M21', cardNo: '3' },
      { id: 'm21-4', name: 'Delta', classId: 'M21', cardNo: '4' },
    ];
    const { groups, entryToSplitId, splitIdToBaseClassId, result, signature } = prepareClassSplits(entries, {
      splitRules: [{ baseClassId: 'M21', partCount: 2, method: 'balanced' }],
    });

    expect(signature).not.toBe('no-split');
    const classIds = groups.map((group) => group.classId);
    expect(classIds).toEqual(expect.arrayContaining(['M21-A', 'M21-B']));
    expect(entryToSplitId.get('m21-1')).toBe('M21-A');
    expect(entryToSplitId.get('m21-2')).toBe('M21-B');
    expect(entryToSplitId.get('m21-3')).toBe('M21-A');
    expect(splitIdToBaseClassId.get('M21-B')).toBe('M21');
    expect(result?.splitClasses.map((item) => item.classId)).toEqual(['M21-A', 'M21-B']);
    expect(result?.splitIdToEntryIds.get('M21-A')).toEqual(['m21-1', 'm21-3']);
  });

  it('deterministically shuffles entries for random split method keeping groups balanced', () => {
    const entries: Entry[] = [
      { id: 'rand-1', name: 'One', classId: 'RAND', cardNo: '1' },
      { id: 'rand-2', name: 'Two', classId: 'RAND', cardNo: '2' },
      { id: 'rand-3', name: 'Three', classId: 'RAND', cardNo: '3' },
      { id: 'rand-4', name: 'Four', classId: 'RAND', cardNo: '4' },
      { id: 'rand-5', name: 'Five', classId: 'RAND', cardNo: '5' },
      { id: 'rand-6', name: 'Six', classId: 'RAND', cardNo: '6' },
      { id: 'rand-7', name: 'Seven', classId: 'RAND', cardNo: '7' },
    ];
    const options = {
      splitRules: [{ baseClassId: 'RAND', partCount: 3, method: 'random' }],
    } as const;

    const first = prepareClassSplits(entries, options);
    const reversed = [...entries].reverse();
    const second = prepareClassSplits(reversed, options);

    const randGroups = first.groups.filter((group) => group.baseClassId === 'RAND');
    expect(randGroups).toHaveLength(3);
    const sizes = randGroups.map((group) => group.entries.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);

    expect(second.signature).toBe(first.signature);
    expect(second.result?.signature).toBe(first.result?.signature);
    expect(second.result?.splitIdToEntryIds.get('RAND-A')).toEqual(
      first.result?.splitIdToEntryIds.get('RAND-A'),
    );
    expect(second.result?.splitIdToEntryIds.get('RAND-B')).toEqual(
      first.result?.splitIdToEntryIds.get('RAND-B'),
    );
    expect(second.result?.splitIdToEntryIds.get('RAND-C')).toEqual(
      first.result?.splitIdToEntryIds.get('RAND-C'),
    );
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

describe('createDefaultClassAssignments', () => {
  const entries: Entry[] = [
    { id: 'entry-1', name: 'A1', classId: 'A', cardNo: '101' },
    { id: 'entry-2', name: 'A2', classId: 'A', cardNo: '102' },
    { id: 'entry-3', name: 'A3', classId: 'A', cardNo: '103' },
    { id: 'entry-4', name: 'A4', classId: 'A', cardNo: '104' },
    { id: 'entry-5', name: 'B1', classId: 'B', cardNo: '201' },
    { id: 'entry-6', name: 'B2', classId: 'B', cardNo: '202' },
    { id: 'entry-7', name: 'B3', classId: 'B', cardNo: '203' },
    { id: 'entry-8', name: 'B4', classId: 'B', cardNo: '204' },
  ];

  const laneAssignments = [
    { laneNumber: 1, classOrder: ['A', 'B'], interval: { milliseconds: 60000 } },
  ];

  it('recreates identical orders when the same seed is reused', () => {
    const first = createDefaultClassAssignments({
      entries,
      playerIntervalMs: 45000,
      laneAssignments,
      startlistId: 'SL-1',
    });

    const second = createDefaultClassAssignments({
      entries,
      playerIntervalMs: 45000,
      laneAssignments,
      startlistId: 'SL-1',
      seed: first.seed,
    });

    expect(second.seed).toBe(first.seed);
    expect(extractOrders(second.assignments)).toEqual(extractOrders(first.assignments));
    expect(first.warnings).toHaveLength(0);
    expect(second.warnings).toHaveLength(0);
  });

  it('refreshes random order when lane assignment signature changes', () => {
    const initial = createDefaultClassAssignments({
      entries,
      playerIntervalMs: 45000,
      laneAssignments,
      startlistId: 'SL-1',
    });

    const reversedLaneAssignments = [
      { laneNumber: 1, classOrder: ['B', 'A'], interval: { milliseconds: 60000 } },
    ];

    const preservedSeed = createDefaultClassAssignments({
      entries,
      playerIntervalMs: 45000,
      laneAssignments: reversedLaneAssignments,
      startlistId: 'SL-1',
      seed: initial.seed,
    });

    const regenerated = createDefaultClassAssignments({
      entries,
      playerIntervalMs: 45000,
      laneAssignments: reversedLaneAssignments,
      startlistId: 'SL-1',
    });

    expect(regenerated.seed).not.toBe(initial.seed);
    expect(extractOrders(preservedSeed.assignments)).toEqual(extractOrders(initial.assignments));
    expect(extractOrders(regenerated.assignments)).not.toEqual(extractOrders(preservedSeed.assignments));
    expect(initial.warnings).toHaveLength(0);
    expect(regenerated.warnings).toHaveLength(0);
  });

  it('invalidates cached seeds when class split rules change', () => {
    const splitEntries: Entry[] = [
      { id: 'split-1', name: 'One', classId: 'SPLIT', cardNo: '1' },
      { id: 'split-2', name: 'Two', classId: 'SPLIT', cardNo: '2' },
      { id: 'split-3', name: 'Three', classId: 'SPLIT', cardNo: '3' },
      { id: 'split-4', name: 'Four', classId: 'SPLIT', cardNo: '4' },
      { id: 'split-5', name: 'Five', classId: 'SPLIT', cardNo: '5' },
      { id: 'split-6', name: 'Six', classId: 'SPLIT', cardNo: '6' },
    ];
    const splitLaneAssignments = [
      { laneNumber: 1, classOrder: ['SPLIT'], interval: { milliseconds: 60000 } },
    ];
    const baseOptions = {
      entries: splitEntries,
      playerIntervalMs: 60000,
      laneAssignments: splitLaneAssignments,
      startlistId: 'SL-SPLIT',
      splitRules: [{ baseClassId: 'SPLIT', partCount: 2, method: 'balanced' }],
    } as const;

    const first = createDefaultClassAssignments(baseOptions);
    expect(first.splitResult?.splitClasses.map((meta) => meta.classId)).toEqual(['SPLIT-A', 'SPLIT-B']);

    const repeated = createDefaultClassAssignments({ ...baseOptions, seed: first.seed });
    expect(repeated.seed).toBe(first.seed);
    expect(extractOrders(repeated.assignments)).toEqual(extractOrders(first.assignments));

    const adjusted = createDefaultClassAssignments({
      ...baseOptions,
      splitRules: [{ baseClassId: 'SPLIT', partCount: 3, method: 'balanced' }],
    });

    expect(adjusted.splitSignature).not.toBe(first.splitSignature);
    expect(adjusted.seed).not.toBe(first.seed);
  });

  it('avoids consecutive clubs when possible and reports warnings otherwise', () => {
    const variedEntries: Entry[] = [
      { id: 'entry-1', name: 'A1', classId: 'A', cardNo: '101', club: 'Alpha' },
      { id: 'entry-2', name: 'A2', classId: 'A', cardNo: '102', club: 'Beta' },
      { id: 'entry-3', name: 'A3', classId: 'A', cardNo: '103', club: 'Alpha' },
      { id: 'entry-4', name: 'A4', classId: 'A', cardNo: '104', club: 'Gamma' },
    ];

    const { assignments, warnings } = createDefaultClassAssignments({
      entries: variedEntries,
      playerIntervalMs: 60000,
      startlistId: 'SL-avoid',
    });

    expect(warnings).toHaveLength(0);
    const order = assignments[0]?.playerOrder ?? [];
    const clubMap = new Map(variedEntries.map((entry) => [entry.id, entry.club]));
    for (let index = 1; index < order.length; index += 1) {
      expect(clubMap.get(order[index - 1])).not.toBe(clubMap.get(order[index]));
    }

    const unavoidableEntries: Entry[] = [
      { id: 'entry-10', name: 'B1', classId: 'B', cardNo: '201', club: 'Delta/Omega' },
      { id: 'entry-11', name: 'B2', classId: 'B', cardNo: '202', club: 'Delta' },
      { id: 'entry-12', name: 'B3', classId: 'B', cardNo: '203', club: 'Omega' },
      { id: 'entry-13', name: 'B4', classId: 'B', cardNo: '204', club: 'Omega' },
    ];

    const unavoidable = createDefaultClassAssignments({
      entries: unavoidableEntries,
      playerIntervalMs: 60000,
      startlistId: 'SL-warning',
    });

    expect(unavoidable.warnings).toHaveLength(1);
    const warning = unavoidable.warnings[0];
    expect(warning.classId).toBe('B');
    const overlapSet = new Set(warning.occurrences.flatMap((occurrence) => occurrence.clubs));
    expect(overlapSet.size).toBeGreaterThan(0);
    expect(overlapSet.has('Omega')).toBe(true);
    expect(overlapSet.has('Delta/Omega')).toBe(false);
  });

  it('skips club warnings when using the unconstrained policy', () => {
    const overlappingEntries: Entry[] = [
      { id: 'entry-20', name: 'C1', classId: 'C', cardNo: '301', club: 'Echo' },
      { id: 'entry-21', name: 'C2', classId: 'C', cardNo: '302', club: 'Echo' },
    ];

    const { warnings } = createDefaultClassAssignments({
      entries: overlappingEntries,
      playerIntervalMs: 60000,
      startlistId: 'SL-unconstrained',
      policy: seededRandomUnconstrainedClassOrderPolicy,
    });

    expect(warnings).toHaveLength(0);
  });

  it('applies world ranking ordering for targeted classes', () => {
    const worldRankingEntries: Entry[] = [
      { id: 'wr-entry-1', name: 'Ranked Low', classId: 'WR', cardNo: '1', iofId: 'IOF-1' },
      { id: 'wr-entry-2', name: 'Ranked High', classId: 'WR', cardNo: '2', iofId: 'IOF-2' },
      { id: 'wr-entry-3', name: 'Unranked Missing ID', classId: 'WR', cardNo: '3' },
      { id: 'wr-entry-4', name: 'Ranked Mid', classId: 'WR', cardNo: '4', iofId: 'IOF-3' },
      { id: 'wr-entry-5', name: 'Unranked Unknown', classId: 'WR', cardNo: '5', iofId: 'IOF-999' },
      { id: 'other-entry-1', name: 'Other One', classId: 'OTHER', cardNo: '10', club: 'Club A' },
      { id: 'other-entry-2', name: 'Other Two', classId: 'OTHER', cardNo: '11', club: 'Club B' },
    ];

    const worldRanking = new Map<string, number>([
      ['IOF-1', 10],
      ['IOF-2', 40],
      ['IOF-3', 20],
    ]);

    const { assignments } = createDefaultClassAssignments({
      entries: worldRankingEntries,
      playerIntervalMs: 60000,
      seed: 'wr-order',
      startOrderRules: [{ id: 'rule-wr', classId: 'WR', method: 'worldRanking', csvName: 'wr.csv' }],
      worldRankingByClass: new Map([['WR', worldRanking]]),
    });

    const wrAssignment = assignments.find((assignment) => assignment.classId === 'WR');
    expect(wrAssignment).toBeDefined();
    const wrOrder = wrAssignment?.playerOrder ?? [];

    const unrankedIds = ['wr-entry-3', 'wr-entry-5'];
    const rankedIds = ['wr-entry-1', 'wr-entry-2', 'wr-entry-4'];
    expect(unrankedIds.every((id) => wrOrder.includes(id))).toBe(true);
    expect(rankedIds.every((id) => wrOrder.includes(id))).toBe(true);
    const lastUnrankedIndex = Math.max(...unrankedIds.map((id) => wrOrder.indexOf(id)));
    const firstRankedIndex = Math.min(...rankedIds.map((id) => wrOrder.indexOf(id)));
    expect(lastUnrankedIndex).toBeLessThan(firstRankedIndex);

    const rankedOrder = wrOrder.filter((id) => rankedIds.includes(id));
    expect(rankedOrder).toEqual(['wr-entry-2', 'wr-entry-4', 'wr-entry-1']);
  });

  it('produces deterministic ordering for world ranking ties based on the seed', () => {
    const tiedEntries: Entry[] = [
      { id: 'tie-entry-1', name: 'Alpha', classId: 'WR-TIE', cardNo: '1', iofId: 'IOF-A' },
      { id: 'tie-entry-2', name: 'Bravo', classId: 'WR-TIE', cardNo: '2', iofId: 'IOF-B' },
      { id: 'tie-entry-3', name: 'Charlie', classId: 'WR-TIE', cardNo: '3', iofId: 'IOF-C' },
    ];

    const worldRanking = new Map<string, number>([
      ['IOF-A', 50],
      ['IOF-B', 50],
      ['IOF-C', 10],
    ]);

    const options = {
      entries: tiedEntries,
      playerIntervalMs: 60000,
      startOrderRules: [
        { id: 'rule-wr-tie', classId: 'WR-TIE', method: 'worldRanking', csvName: 'tie.csv' },
      ],
      worldRankingByClass: new Map([['WR-TIE', worldRanking]]),
    } as const;

    const first = createDefaultClassAssignments({ ...options, seed: 'wr-seed-tie' });
    const second = createDefaultClassAssignments({ ...options, seed: 'wr-seed-tie' });

    expect(first.assignments[0]?.playerOrder).toEqual(second.assignments[0]?.playerOrder);
  });

  it('falls back to seeded random ordering when rankings are unavailable', () => {
    const fallbackEntries: Entry[] = [
      { id: 'fallback-1', name: 'Alpha', classId: 'WR-NONE', cardNo: '1', club: 'Club A' },
      { id: 'fallback-2', name: 'Bravo', classId: 'WR-NONE', cardNo: '2', club: 'Club B' },
      { id: 'fallback-3', name: 'Charlie', classId: 'WR-NONE', cardNo: '3', club: 'Club A' },
    ];

    const baseline = createDefaultClassAssignments({
      entries: fallbackEntries,
      playerIntervalMs: 60000,
      seed: 'wr-fallback',
    });

    const withTargets = createDefaultClassAssignments({
      entries: fallbackEntries,
      playerIntervalMs: 60000,
      seed: 'wr-fallback',
      startOrderRules: [
        { id: 'rule-wr-none', classId: 'WR-NONE', method: 'worldRanking', csvName: 'none.csv' },
      ],
      worldRankingByClass: new Map(),
    });

    expect(withTargets.assignments[0]?.playerOrder).toEqual(baseline.assignments[0]?.playerOrder);
  });
});

describe('deriveClassOrderWarnings', () => {
  it('recomputes warnings for existing assignments', () => {
    const entries: Entry[] = [
      { id: 'entry-1', name: 'A', classId: 'A', cardNo: '1', club: 'Same' },
      { id: 'entry-2', name: 'B', classId: 'A', cardNo: '2', club: 'Same' },
      { id: 'entry-3', name: 'C', classId: 'A', cardNo: '3', club: 'Different' },
    ];

    const assignments = [
      { classId: 'A', playerOrder: ['entry-1', 'entry-2', 'entry-3'], interval: { milliseconds: 60000 } },
    ];

    const warnings = deriveClassOrderWarnings(assignments, entries);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.occurrences).toHaveLength(1);
    expect(warnings[0]?.occurrences[0]?.clubs).toContain('Same');
  });

  it('aggregates warnings for split classes under the base id', () => {
    const entries: Entry[] = [
      { id: 'split-1', name: 'Alpha', classId: 'SP', cardNo: '1', club: 'Club X' },
      { id: 'split-2', name: 'Bravo', classId: 'SP', cardNo: '2', club: 'Club Y' },
      { id: 'split-3', name: 'Charlie', classId: 'SP', cardNo: '3', club: 'Club X' },
      { id: 'split-4', name: 'Delta', classId: 'SP', cardNo: '4', club: 'Club Y' },
    ];
    const assignments = [
      { classId: 'SP-A', playerOrder: ['split-1', 'split-3'], interval: { milliseconds: 60000 } },
      { classId: 'SP-B', playerOrder: ['split-2', 'split-4'], interval: { milliseconds: 60000 } },
    ];

    const warnings = deriveClassOrderWarnings(assignments, entries, {
      splitRules: [{ baseClassId: 'SP', partCount: 2, method: 'balanced' }],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.classId).toBe('SP');
    expect(warnings[0]?.occurrences).toHaveLength(2);
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
    const { assignments: classAssignments } = createDefaultClassAssignments({
      entries,
      playerIntervalMs: 60000,
      startlistId: 'SL-1',
    });
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
    expect(result.map((item) => item.playerId)).toEqual(['entry-2', 'entry-1', 'entry-3']);
    expect(first.laneNumber).toBe(1);
    expect(new Date(first.startTime).toISOString()).toBe(settings.startTime);
    expect(new Date(second.startTime).toISOString()).toBe(
      new Date(new Date(settings.startTime).getTime() + 60000).toISOString(),
    );
    expect(new Date(third.startTime).toISOString()).toBe(
      new Date(new Date(settings.startTime).getTime() + 60000 * 2 + 90000).toISOString(),
    );
  });

  it('uses split class mappings when calculating start times', () => {
    const splitEntries: Entry[] = [
      { id: 'split-1', name: 'One', classId: 'SP', cardNo: '1' },
      { id: 'split-2', name: 'Two', classId: 'SP', cardNo: '2' },
      { id: 'split-3', name: 'Three', classId: 'SP', cardNo: '3' },
      { id: 'split-4', name: 'Four', classId: 'SP', cardNo: '4' },
    ];
    const { result: splitResult } = prepareClassSplits(splitEntries, {
      splitRules: [{ baseClassId: 'SP', partCount: 2, method: 'balanced' }],
    });
    const laneAssignments = [
      { laneNumber: 1, classOrder: ['SP-A', 'SP-B'], interval: { milliseconds: 60000 } },
    ];
    const classAssignments = [
      { classId: 'SP-A', playerOrder: ['split-1', 'split-3'], interval: { milliseconds: 60000 } },
      { classId: 'SP-B', playerOrder: ['split-2', 'split-4'], interval: { milliseconds: 60000 } },
    ];
    const settings = {
      eventId: 'event-split',
      startTime: new Date('2024-02-01T09:00:00.000Z').toISOString(),
      intervals: {
        laneClass: { milliseconds: 60000 },
        classPlayer: { milliseconds: 60000 },
      },
      laneCount: 1,
    };

    const result = calculateStartTimes({
      settings,
      laneAssignments,
      classAssignments,
      entries: splitEntries,
      splitRules: [{ baseClassId: 'SP', partCount: 2, method: 'balanced' }],
      splitResult: splitResult,
    });

    expect(result.map((item) => item.playerId)).toEqual(['split-1', 'split-3', 'split-2', 'split-4']);
  });
});
