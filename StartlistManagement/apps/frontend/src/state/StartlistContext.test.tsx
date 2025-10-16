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
} from './StartlistContext';

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
      laneClassInterval: { milliseconds: 60000 },
      classPlayerInterval: { milliseconds: 45000 },
      laneCount: 2,
    };

    act(() => {
      updateSettings(result.current.dispatch, { startlistId: 'SL-1', settings });
      appendEntry(result.current.dispatch, { name: 'A', classId: 'M21', cardNo: '1' });
      setStatus(result.current.dispatch, 'entries', createStatus('ok', 'success'));
      setLoading(result.current.dispatch, 'entries', true);
      updateLaneAssignments(result.current.dispatch, [
        { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
      ]);
      updateClassAssignments(result.current.dispatch, [
        { classId: 'M21', playerOrder: ['1'], interval: { milliseconds: 60000 } },
      ]);
      updateStartTimes(result.current.dispatch, [
        { playerId: '1', laneNumber: 1, startTime: settings.startTime },
      ]);
      updateSnapshot(result.current.dispatch, { foo: 'bar' });
    });

    expect(result.current.state.startlistId).toBe('SL-1');
    expect(result.current.state.entries).toHaveLength(1);
    expect(result.current.state.statuses.entries.text).toBe('ok');
    expect(result.current.state.loading.entries).toBe(true);
    expect(result.current.state.laneAssignments).toHaveLength(1);
    expect(result.current.state.classAssignments).toHaveLength(1);
    expect(result.current.state.startTimes).toHaveLength(1);
    expect(result.current.state.snapshot).toEqual({ foo: 'bar' });

    act(() => {
      removeEntry(result.current.dispatch, '1');
      setLoading(result.current.dispatch, 'entries', false);
    });

    expect(result.current.state.entries).toHaveLength(0);
    expect(result.current.state.loading.entries).toBe(false);
  });
});
