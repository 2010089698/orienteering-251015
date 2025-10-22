import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  StartlistProvider,
  useStartlistState,
  useStartlistDispatch,
  useStartlistEntries,
  useStartlistEditingEntryId,
  useSetStartlistEditingEntryId,
  useStartlistStatuses,
  useStartlistEventContext,
  useStartlistEventLinkStatus,
  createStatus,
  setStatus,
  setLoading,
  updateSettings,
  appendEntry,
  removeEntry,
  updateEntry,
  updateLaneAssignments,
  updateClassAssignments,
  updateStartTimes,
  updateSnapshot,
  updateEntries,
  setStartOrderRules,
  updateClassWorldRanking,
  setClassSplitRules,
  setClassSplitResult,
  updateVersionHistory,
  updateDiff,
  setEventContext,
  setEventLinkStatus,
} from './StartlistContext';
import type { ClassSplitResult, ClassSplitRule, StartlistState } from './types';
import type { StartlistDiffDto, StartlistVersionSummaryDto } from '@startlist-management/application';

describe('StartlistContext', () => {
  it('throws when hooks used outside provider', () => {
    expect(() => renderHook(() => useStartlistState())).toThrowError();
    expect(() => renderHook(() => useStartlistDispatch())).toThrowError();
    expect(() => renderHook(() => useStartlistEntries())).toThrowError();
    expect(() => renderHook(() => useStartlistEditingEntryId())).toThrowError();
    expect(() => renderHook(() => useSetStartlistEditingEntryId())).toThrowError();
    expect(() => renderHook(() => useStartlistEventContext())).toThrowError();
    expect(() => renderHook(() => useStartlistEventLinkStatus())).toThrowError();
  });

  it('avoids re-rendering unrelated subscribers when slices change', () => {
    let dispatch: ReturnType<typeof useStartlistDispatch> | undefined;
    const entriesRefs: StartlistState['entries'][] = [];
    const statusesRefs: StartlistState['statuses'][] = [];

    const EntriesSubscriber = () => {
      entriesRefs.push(useStartlistEntries());
      return null;
    };

    const StatusesSubscriber = () => {
      statusesRefs.push(useStartlistStatuses());
      return null;
    };

    const DispatchSubscriber = () => {
      dispatch = useStartlistDispatch();
      return null;
    };

    render(
      <StartlistProvider>
        <EntriesSubscriber />
        <StatusesSubscriber />
        <DispatchSubscriber />
      </StartlistProvider>,
    );

    const safeDispatch = dispatch;
    if (!safeDispatch) {
      throw new Error('dispatch is not available');
    }

    const uniqueEntriesCount = () => new Set(entriesRefs).size;
    const uniqueStatusesCount = () => new Set(statusesRefs).size;

    const initialEntriesCount = uniqueEntriesCount();
    const initialStatusesCount = uniqueStatusesCount();

    expect(initialEntriesCount).toBeGreaterThan(0);
    expect(initialStatusesCount).toBeGreaterThan(0);

    act(() => {
      setStatus(safeDispatch, 'entries', createStatus('ok', 'success'));
    });

    expect(uniqueEntriesCount()).toBe(initialEntriesCount);
    expect(uniqueStatusesCount()).toBe(initialStatusesCount + 1);

    act(() => {
      appendEntry(safeDispatch, { name: 'Runner', classId: 'M21', cardNo: '1' });
    });

    expect(uniqueEntriesCount()).toBe(initialEntriesCount + 1);
    expect(uniqueStatusesCount()).toBe(initialStatusesCount + 1);
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

    const versions: StartlistVersionSummaryDto[] = [
      { version: 2, confirmedAt: '2024-04-02T00:00:00.000Z' },
      { version: 1, confirmedAt: '2024-04-01T00:00:00.000Z' },
    ];

    const diff: StartlistDiffDto = {
      startlistId: 'SL-1',
      to: versions[0],
      from: versions[1],
      changes: {
        startTimes: {
          previous: [
            { playerId: 'prev-player', laneNumber: 1, startTime: settings.startTime },
          ],
          current: [
            { playerId: 'current-player', laneNumber: 2, startTime: settings.startTime },
          ],
        },
      },
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
      const entry = result.current.state.entries[0];
      if (!entry) {
        throw new Error('entry is not available');
      }
      updateEntry(result.current.dispatch, { ...entry, cardNo: '42' });
      setStatus(result.current.dispatch, 'entries', createStatus('ok', 'success'));
      setLoading(result.current.dispatch, 'entries', true);
      setClassSplitRules(result.current.dispatch, [
        { baseClassId: 'M21', partCount: 2, method: 'random' },
      ]);
      const splitResult = createSplitResult({
        signature: 'sig-1',
        baseClassId: 'M21',
        splitId: 'M211',
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
      updateSnapshot(result.current.dispatch, {
        id: 'SL-1',
        status: 'SETTINGS_ENTERED',
        laneAssignments: [],
        classAssignments: [],
        startTimes: [],
        versions,
        diff,
      });
      setStartOrderRules(result.current.dispatch, [
        { id: 'rule-1', classId: 'M21', method: 'worldRanking', csvName: 'ranking.csv' },
      ]);
      updateClassWorldRanking(result.current.dispatch, 'M21', new Map([['IOF001', 12]]));
      setEventContext(result.current.dispatch, { eventId: 'event', raceId: 'race-42' });
      setEventLinkStatus(result.current.dispatch, {
        status: 'success',
        eventId: 'event',
        raceId: 'race-42',
        startlistLink: 'https://example.com/startlists/SL-1/v/2',
        startlistUpdatedAt: '2024-04-02T00:00:00.000Z',
        startlistPublicVersion: 2,
      });
    });

    expect(result.current.state.startlistId).toBe('SL-1');
    expect(result.current.state.settings?.eventId).toBe('event');
    expect(result.current.state.entries).toHaveLength(1);
    expect(result.current.state.entries[0]?.iofId).toBe('IOF001');
    expect(result.current.state.entries[0]?.cardNo).toBe('42');
    expect(result.current.state.statuses.entries.text).toBe('ok');
    expect(result.current.state.loading.entries).toBe(true);
    expect(result.current.state.eventContext).toEqual({ eventId: 'event', raceId: 'race-42' });
    expect(result.current.state.laneAssignments).toHaveLength(1);
    expect(result.current.state.classAssignments).toHaveLength(1);
    expect(result.current.state.startTimes).toHaveLength(1);
    expect(result.current.state.classSplitRules).toEqual([
      { baseClassId: 'M21', partCount: 2, method: 'random' },
    ]);
    expect(result.current.state.classSplitResult?.signature).toBe('sig-1');
    expect(result.current.state.snapshot?.id).toBe('SL-1');
    expect(result.current.state.versionHistory).toEqual([
      { version: 2, confirmedAt: '2024-04-02T00:00:00.000Z' },
      { version: 1, confirmedAt: '2024-04-01T00:00:00.000Z' },
    ]);
    expect(result.current.state.latestVersion?.version).toBe(2);
    expect(result.current.state.previousVersion?.version).toBe(1);
    expect(result.current.state.diff).toEqual(diff);
    expect(result.current.state.startOrderRules).toEqual([
      { id: 'rule-1', classId: 'M21', method: 'worldRanking', csvName: 'ranking.csv' },
    ]);
    expect(result.current.state.worldRankingByClass.get('M21')?.get('IOF001')).toBe(12);
    expect(result.current.state.eventLinkStatus).toEqual({
      status: 'success',
      eventId: 'event',
      raceId: 'race-42',
      startlistLink: 'https://example.com/startlists/SL-1/v/2',
      startlistUpdatedAt: '2024-04-02T00:00:00.000Z',
      startlistPublicVersion: 2,
    });

    act(() => {
      removeEntry(result.current.dispatch, entryId);
      setLoading(result.current.dispatch, 'entries', false);
      updateVersionHistory(result.current.dispatch, []);
      updateDiff(result.current.dispatch, undefined);
    });

    expect(result.current.state.entries).toHaveLength(0);
    expect(result.current.state.loading.entries).toBe(false);
    expect(result.current.state.versionHistory).toEqual([]);
    expect(result.current.state.latestVersion).toBeUndefined();
    expect(result.current.state.previousVersion).toBeUndefined();
    expect(result.current.state.diff).toBeUndefined();
  });

  it('manages editing entry id through dedicated hooks', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StartlistProvider>{children}</StartlistProvider>;
    const { result } = renderHook(
      () => ({
        entries: useStartlistEntries(),
        dispatch: useStartlistDispatch(),
        editingEntryId: useStartlistEditingEntryId(),
        setEditingEntryId: useSetStartlistEditingEntryId(),
      }),
      { wrapper },
    );

    act(() => {
      appendEntry(result.current.dispatch, { name: 'Runner', classId: 'M21', cardNo: '1' });
    });

    const entryId = result.current.entries[0]?.id ?? '';
    expect(entryId).not.toBe('');

    act(() => {
      result.current.setEditingEntryId(entryId);
    });

    expect(result.current.editingEntryId).toBe(entryId);

    act(() => {
      const entry = result.current.entries[0];
      if (!entry) {
        throw new Error('entry is not available');
      }
      updateEntry(result.current.dispatch, { ...entry, name: 'Updated Runner' });
    });

    expect(result.current.entries[0]?.name).toBe('Updated Runner');

    act(() => {
      result.current.setEditingEntryId(undefined);
    });

    expect(result.current.editingEntryId).toBeUndefined();
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

  it('selects slices via dedicated hooks', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StartlistProvider>{children}</StartlistProvider>;
    const { result } = renderHook(
      () => ({
        entries: useStartlistEntries(),
        statuses: useStartlistStatuses(),
        dispatch: useStartlistDispatch(),
      }),
      { wrapper },
    );

    act(() => {
      appendEntry(result.current.dispatch, { name: 'Runner', classId: 'M21', cardNo: '1' });
      setStatus(result.current.dispatch, 'entries', createStatus('ok', 'success'));
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.statuses.entries.text).toBe('ok');
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
      splitId: 'M211',
    });
    const nextSplit = createSplitResult({
      signature: 'sig-2',
      baseClassId: 'M21',
      splitId: 'M212',
    });

    act(() => {
      setClassSplitRules(result.current.dispatch, [
        { baseClassId: 'M21', partCount: 2, method: 'random' },
      ]);
      setClassSplitResult(result.current.dispatch, initialSplit);
      updateLaneAssignments(result.current.dispatch, [
        { laneNumber: 1, classOrder: ['M211'], interval: { milliseconds: 60000 } },
      ], initialSplit);
      updateClassAssignments(
        result.current.dispatch,
        [{ classId: 'M211', playerOrder: ['p1'], interval: { milliseconds: 60000 } }],
        'seed-1',
        [{ classId: 'M211', occurrences: [] }],
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
      splitId: 'M211',
    });

    act(() => {
      setClassSplitResult(result.current.dispatch, split);
      updateLaneAssignments(result.current.dispatch, [
        { laneNumber: 1, classOrder: ['M211'], interval: { milliseconds: 60000 } },
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
