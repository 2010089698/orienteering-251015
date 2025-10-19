import { describe, expect, it } from 'vitest';
import {
  classSplitReducer,
  initialClassSplitState,
  shouldResetForSplitChange,
} from '../classSplitSlice';

const createSplit = (signature: string) => ({
  signature,
  splitClasses: [],
  entryToSplitId: new Map<string, string>(),
  splitIdToEntryIds: new Map<string, string[]>(),
});

describe('classSplitSlice', () => {
  it('sets rules and results', () => {
    const withRules = classSplitReducer(initialClassSplitState, {
      type: 'classSplit/setRules',
      payload: [{ baseClassId: 'M21', partCount: 2, method: 'balanced' }],
    });

    expect(withRules.classSplitRules).toHaveLength(1);

    const split = createSplit('sig-1');
    const withResult = classSplitReducer(withRules, {
      type: 'classSplit/setResult',
      payload: split,
    });

    expect(withResult.classSplitResult).toBe(split);
  });

  it('detects when split signatures change', () => {
    const left = createSplit('sig-1');
    const right = createSplit('sig-2');

    expect(shouldResetForSplitChange(left, left)).toBe(false);
    expect(shouldResetForSplitChange(left, right)).toBe(true);
    expect(shouldResetForSplitChange(undefined, right)).toBe(true);
  });
});
