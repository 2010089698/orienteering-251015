import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  StartlistProvider,
  useStartlistState,
  useStartlistDispatch,
  createStatus,
  setStatus,
  setLoading,
  updateSettings,
  appendEntry,
  removeEntry,
  updateLaneAssignments,
  updateClassAssignments,
  updateStartTimes,
  updateSnapshot,
  updateEntries,
  setStartOrderRules,
  updateClassWorldRanking,
  setClassSplitRules,
  setClassSplitResult,
} from './StartlistContext';
import type { ClassSplitResult, ClassSplitRule } from './types';

describe('StartlistContext', () => {
  it('throws when hooks used outside provider', () => {
    expect(() => renderHook(() => useStartlistState())).toThrowError();
    expect(() => renderHook(() => useStartlistDispatch())).toThrowError();
  });

  it('updates state via exposed helpers', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StartlistProvider>{children}</StartlistProvider>;
    const { result } = renderHook(
      () => ({
        state: useStartlistState(),
        dispatch: useStartlistDispatch(),
      }),
      { wrapper },
    );

    const settings = {
      eventId: 'event',
      startTime: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      intervals: {
        laneClass: { milliseconds: 60000 },
        classPlayer: { milliseconds: 45000 },
      },
      laneCount: 2,
    };

    act(() => {
      updateSettings(result.current.dispatch, { startlistId: 'SL-1', settings });
      appendEntry(result.current.dispatch, {
        name: 'A',
        classId: 'M21',
        cardNo: '1',
        iofId: 'IOF001',
      });
    });

    const entryId = result.current.state.entries[0]?.id ?? '';

    act(() => {
      setStatus(result.current.dispatch, 'entries', createStatus('ok', 'success'));
      setLoading(result.current.dispatch, 'entries', true);
      setClassSplitRules(result.current.dispatch, [
        { baseClassId: 'M21', partCount: 2, method: 'balanced' },
      ]);
      const splitResult = createSplitResult({
        signature: 'sig-1',
        baseClassId: 'M21',
        splitId: 'M21-A',
      });
      setClassSplitResult(result.current.dispatch, splitResult);
      updateLaneAssignments(result.current.dispatch, [
        { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
      ], splitResult);
      updateClassAssignments(result.current.dispatch, [
        { classId: 'M21', playerOrder: [entryId], interval: { milliseconds: 60000 } },
      ], undefined, undefined, splitResult);
      updateStartTimes(result.current.dispatch, [
        { playerId: entryId, laneNumber: 1, startTime: settings.startTime },
      ], splitResult);
      updateSnapshot(result.current.dispatch, { foo: 'bar' });
      setStartOrderRules(result.current.dispatch, [
        { id: 'rule-1', classId: 'M21', method: 'worldRanking', csvName: 'ranking.csv' },
      ]);
      updateClassWorldRanking(result.current.dispatch, 'M21', new Map([['IOF001', 12]]));
    });

    expect(result.current.state.startlistId).toBe('SL-1');
    expect(result.current.state.entries).toHaveLength(1);
    expect(result.current.state.entries[0]?.iofId).toBe('IOF001');
    expect(result.current.state.statuses.entries.text).toBe('ok');
    expect(result.current.state.loading.entries).toBe(true);
    expect(result.current.state.laneAssignments).toHaveLength(1);
    expect(result.current.state.classAssignments).toHaveLength(1);
    expect(result.current.state.startTimes).toHaveLength(1);
    expect(result.current.state.classSplitRules).toEqual([
      { baseClassId: 'M21', partCount: 2, method: 'balanced' },
    ]);
    expect(result.current.state.classSplitResult?.signature).toBe('sig-1');
    expect(result.current.state.snapshot).toEqual({ foo: 'bar' });
    expect(result.current.state.startOrderRules).toEqual([
      { id: 'rule-1', classId: 'M21', method: 'worldRanking', csvName: 'ranking.csv' },
    ]);
    expect(result.current.state.worldRankingByClass.get('M21')?.get('IOF001')).toBe(12);

    act(() => {
      removeEntry(result.current.dispatch, entryId);
      setLoading(result.current.dispatch, 'entries', false);
    });

    expect(result.current.state.entries).toHaveLength(0);
    expect(result.current.state.loading.entries).toBe(false);
  });

  it('assigns unique ids when merging entries containing レンタル card numbers', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StartlistProvider>{children}</StartlistProvider>;
    const { result } = renderHook(
      () => ({
        state: useStartlistState(),
        dispatch: useStartlistDispatch(),
      }),
      { wrapper },
    );

    act(() => {
      updateEntries(result.current.dispatch, [
        { id: 'existing-rental', name: 'Existing Rental', classId: 'M21', cardNo: 'レンタル' },
        { name: 'New Rental', classId: 'M21', cardNo: 'レンタル' },
      ]);
    });

    expect(result.current.state.entries).toHaveLength(2);
    const [first, second] = result.current.state.entries;
    expect(first.cardNo).toBe('レンタル');
    expect(second.cardNo).toBe('レンタル');
    expect(first.id).not.toBe(second.id);
  });

  it('resets assignments when split signature changes and retains world ranking', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StartlistProvider>{children}</StartlistProvider>;
    const { result } = renderHook(
      () => ({
        state: useStartlistState(),
        dispatch: useStartlistDispatch(),
      }),
      { wrapper },
    );

    const initialSplit = createSplitResult({
      signature: 'sig-1',
      baseClassId: 'M21',
      splitId: 'M21-A',
    });
    const nextSplit = createSplitResult({
      signature: 'sig-2',
      baseClassId: 'M21',
      splitId: 'M21-B',
    });

    act(() => {
      setClassSplitRules(result.current.dispatch, [
        { baseClassId: 'M21', partCount: 2, method: 'balanced' },
      ]);
      setClassSplitResult(result.current.dispatch, initialSplit);
      updateLaneAssignments(result.current.dispatch, [
        { laneNumber: 1, classOrder: ['M21-A'], interval: { milliseconds: 60000 } },
      ], initialSplit);
      updateClassAssignments(
        result.current.dispatch,
        [{ classId: 'M21-A', playerOrder: ['p1'], interval: { milliseconds: 60000 } }],
        'seed-1',
        [{ classId: 'M21-A', occurrences: [] }],
        initialSplit,
      );
      updateStartTimes(
        result.current.dispatch,
        [{ playerId: 'p1', laneNumber: 1, startTime: new Date().toISOString() }],
        initialSplit,
      );
      updateClassWorldRanking(result.current.dispatch, 'M21', new Map([['WR1', 1]]));
    });

    expect(result.current.state.laneAssignments).toHaveLength(1);
    expect(result.current.state.classAssignments).toHaveLength(1);
    expect(result.current.state.startTimes).toHaveLength(1);
    expect(result.current.state.classOrderSeed).toBe('seed-1');
    expect(result.current.state.classOrderWarnings).toHaveLength(1);

    act(() => {
      setClassSplitResult(result.current.dispatch, nextSplit);
    });

    expect(result.current.state.classSplitResult?.signature).toBe('sig-2');
    expect(result.current.state.laneAssignments).toEqual([]);
    expect(result.current.state.classAssignments).toEqual([]);
    expect(result.current.state.startTimes).toEqual([]);
    expect(result.current.state.classOrderSeed).toBeUndefined();
    expect(result.current.state.classOrderWarnings).toEqual([]);
    expect(result.current.state.worldRankingByClass.get('M21')?.get('WR1')).toBe(1);
  });

  it('keeps assignments when split signature remains unchanged', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StartlistProvider>{children}</StartlistProvider>;
    const { result } = renderHook(
      () => ({
        state: useStartlistState(),
        dispatch: useStartlistDispatch(),
      }),
      { wrapper },
    );

    const split = createSplitResult({
      signature: 'sig-constant',
      baseClassId: 'M21',
      splitId: 'M21-A',
    });

    act(() => {
      setClassSplitResult(result.current.dispatch, split);
      updateLaneAssignments(result.current.dispatch, [
        { laneNumber: 1, classOrder: ['M21-A'], interval: { milliseconds: 60000 } },
      ], split);
    });

    act(() => {
      setClassSplitResult(result.current.dispatch, split);
    });

    expect(result.current.state.laneAssignments).toHaveLength(1);
    expect(result.current.state.classSplitResult?.signature).toBe('sig-constant');
  });
});

const createSplitResult = ({
  signature,
  baseClassId,
  splitId,
}: {
  signature: string;
  baseClassId: ClassSplitRule['baseClassId'];
  splitId: string;
}): ClassSplitResult => ({
  signature,
  splitClasses: [
    {
      classId: splitId,
      baseClassId,
      splitIndex: 0,
    },
  ],
  entryToSplitId: new Map(),
  splitIdToEntryIds: new Map(),
});
