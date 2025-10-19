import { describe, expect, it } from 'vitest';
import type { LaneAssignmentDto } from '@startlist-management/application';
import {
  lanesReducer,
  initialLanesState,
  createLaneAssignmentAction,
  type LanesReducerContext,
} from '../lanesSlice';
import { deriveSeededRandomClassOrderSeed } from '../../../utils/classOrderPolicy';

const baseContext: LanesReducerContext = {
  startlistId: 'SL-test',
  entries: [],
};

describe('lanesSlice', () => {
  it('updates lane assignments when no class order is set', () => {
    const assignments: LaneAssignmentDto[] = [
      { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
    ];

    const next = lanesReducer(initialLanesState, createLaneAssignmentAction(assignments), baseContext);

    expect(next.laneAssignments).toEqual(assignments);
    expect(next.classAssignments).toEqual([]);
  });

  it('keeps class assignments when derived seed matches existing seed', () => {
    const assignments: LaneAssignmentDto[] = [
      { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
    ];
    const seed = deriveSeededRandomClassOrderSeed({
      startlistId: baseContext.startlistId,
      entries: [],
      laneAssignments: assignments,
    });

    const state = {
      ...initialLanesState,
      classAssignments: [
        { classId: 'M21', playerOrder: ['p1'], interval: { milliseconds: 60000 } },
      ],
      classOrderSeed: seed,
    };

    const next = lanesReducer(state, createLaneAssignmentAction(assignments), baseContext);

    expect(next.classAssignments).toEqual(state.classAssignments);
    expect(next.classOrderSeed).toBe(seed);
  });

  it('resets class assignments when derived seed changes', () => {
    const currentAssignments: LaneAssignmentDto[] = [
      { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
    ];
    const nextAssignments: LaneAssignmentDto[] = [
      { laneNumber: 1, classOrder: ['W21'], interval: { milliseconds: 60000 } },
    ];
    const seed = deriveSeededRandomClassOrderSeed({
      startlistId: baseContext.startlistId,
      entries: [],
      laneAssignments: currentAssignments,
    });

    const state = {
      ...initialLanesState,
      laneAssignments: currentAssignments,
      classAssignments: [
        { classId: 'M21', playerOrder: ['p1'], interval: { milliseconds: 60000 } },
      ],
      classOrderSeed: seed,
      classOrderWarnings: [{ classId: 'M21', occurrences: [] }],
    };

    const next = lanesReducer(state, createLaneAssignmentAction(nextAssignments), baseContext);

    expect(next.laneAssignments).toEqual(nextAssignments);
    expect(next.classAssignments).toEqual([]);
    expect(next.classOrderSeed).toBeUndefined();
    expect(next.classOrderWarnings).toEqual([]);
  });
});
