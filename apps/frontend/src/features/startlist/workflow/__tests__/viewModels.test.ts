import { describe, expect, it } from 'vitest';

import { createInputStepViewModel } from '../createInputStepViewModel';
import {
  createLaneAssignmentViewModel,
  moveClassBetweenLanes,
} from '../createLaneAssignmentViewModel';
import {
  createClassOrderViewModel,
  playerItemId,
  parsePlayerItemId,
} from '../createClassOrderViewModel';

const entries = [
  { id: '1', name: 'A', classId: 'M21', cardNo: '1' },
  { id: '2', name: 'B', classId: 'W21', cardNo: '2' },
  { id: '3', name: 'C', classId: 'M21', cardNo: '3' },
];

describe('createInputStepViewModel', () => {
  it('creates tabs and filters entries', () => {
    const viewModel = createInputStepViewModel({ entries, activeTab: 'M21' });
    expect(viewModel.tabs).toHaveLength(3);
    expect(viewModel.tabs[1]).toEqual({ id: 'M21', label: 'M21', count: 2 });
    expect(viewModel.filteredEntries.map((entry) => entry.id)).toEqual(['1', '3']);
  });

  it('falls back to the all tab when the active tab disappears', () => {
    const viewModel = createInputStepViewModel({ entries, activeTab: 'UNKNOWN' });
    expect(viewModel.activeTab).toBe('all');
    expect(viewModel.filteredEntries).toHaveLength(3);
  });
});

describe('createLaneAssignmentViewModel', () => {
  const laneAssignments = [
    { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
    { laneNumber: 2, classOrder: ['W21'], interval: { milliseconds: 60000 } },
  ];
  const settings = {
    laneCount: 2,
    startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
    intervals: {
      laneClass: { milliseconds: 60000 },
      classPlayer: { milliseconds: 45000 },
    },
  } as any;

  it('builds lane summaries with time ranges and split metadata', () => {
    const viewModel = createLaneAssignmentViewModel({
      entries,
      laneAssignments,
      settings,
      classSplitRules: [],
      classSplitResult: undefined,
      startOrderRules: [],
      worldRankingByClass: new Map(),
    });
    expect(viewModel.laneSummaries).toHaveLength(2);
    expect(viewModel.laneSummaries[0].classSummaries[0].timeRangeLabel).toMatch(/\d{2}:\d{2}/);
    expect(viewModel.laneSummaries[1].classSummaries[0].competitorCount).toBe(1);
    expect(viewModel.tabs.map((tab) => tab.id)).toEqual(['overview', 'lane-1', 'lane-2']);
  });

  it('moves classes between lanes while preserving order', () => {
    const result = moveClassBetweenLanes(laneAssignments, 'M21', 2, 60000, 0);
    expect(result[0].classOrder).toEqual(['M21', 'W21']);
  });
});

describe('createClassOrderViewModel', () => {
  const classAssignments = [
    { classId: 'M21', playerOrder: ['1', '3'] },
    { classId: 'W21', playerOrder: ['2'] },
  ];
  const startTimes = [
    { playerId: '1', startTime: new Date('2024-01-01T09:00:00Z').toISOString(), laneNumber: 1 },
    { playerId: '3', startTime: new Date('2024-01-01T09:02:00Z').toISOString(), laneNumber: 1 },
    { playerId: '2', startTime: new Date('2024-01-01T09:01:00Z').toISOString(), laneNumber: 2 },
  ];
  const laneAssignments = [
    { laneNumber: 1, classOrder: ['M21'] },
    { laneNumber: 2, classOrder: ['W21'] },
  ];

  it('creates class tabs with lane metadata and summaries', () => {
    const viewModel = createClassOrderViewModel({
      classAssignments: classAssignments as any,
      startTimes: startTimes as any,
      entries: entries as any,
      laneAssignments: laneAssignments as any,
      classOrderWarnings: [],
      classOrderPreferences: { avoidConsecutiveClubs: true },
      classSplitRules: [],
      classSplitResult: undefined,
    });
    expect(viewModel.tabs).toHaveLength(2);
    expect(viewModel.tabs[0].label).toContain('レーン1');
    const startRows = viewModel.startTimeRowsByClass.get('M21') ?? [];
    expect(startRows[0].startTimeLabel).toMatch(/\d{2}:\d{2}/);
  });

  it('generates deterministic drag identifiers', () => {
    const id = playerItemId('M21', '1');
    expect(id).toBe('M21::1');
    expect(parsePlayerItemId(id)).toEqual({ classId: 'M21', playerId: '1' });
  });
});
