import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PropsWithChildren, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import useStartOrderSettings from '../useStartOrderSettings';
import {
  StartlistProvider,
  setStartOrderRules,
  updateEntries,
  useStartlistDispatch,
  useStartlistStartOrderRules,
} from '../../state/StartlistContext';
import type { StartOrderRules } from '../../state/types';

const entries = [
  { id: 'entry-1', name: 'Runner A', classId: 'M21', cardNo: '1' },
  { id: 'entry-2', name: 'Runner B', classId: 'W21', cardNo: '2' },
];

interface WrapperProps {
  initialStartOrderRules?: StartOrderRules;
}

const StartlistInitializer = ({ children, initialStartOrderRules }: PropsWithChildren<WrapperProps>) => {
  const dispatch = useStartlistDispatch();

  useEffect(() => {
    updateEntries(dispatch, entries);
    if (initialStartOrderRules) {
      setStartOrderRules(dispatch, initialStartOrderRules);
    }
  }, [dispatch, initialStartOrderRules]);

  return <>{children}</>;
};

const createWrapper = (initialStartOrderRules?: WrapperProps['initialStartOrderRules']) => {
  const Wrapper = ({ children }: PropsWithChildren<object>) => (
    <StartlistProvider>
      <StartlistInitializer initialStartOrderRules={initialStartOrderRules}>
        {children}
      </StartlistInitializer>
    </StartlistProvider>
  );
  return Wrapper;
};

describe('useStartOrderSettings', () => {
  it('synchronizes rows when the store updates', async () => {
    const wrapper = createWrapper([
      { id: 'rule-1', classId: 'M21', method: 'worldRanking', csvName: 'm21.csv' },
    ]);

    const { result } = renderHook(
      () => ({
        hook: useStartOrderSettings(),
        dispatch: useStartlistDispatch(),
      }),
      { wrapper },
    );

    expect(result.current.hook.rows).toEqual([
      { id: 'rule-1', classId: 'M21', method: 'worldRanking', csvName: 'm21.csv' },
    ]);

    act(() => {
      setStartOrderRules(result.current.dispatch, [
        { id: 'rule-1', classId: 'M21', method: 'random' },
        { id: 'rule-2', classId: 'W21', method: 'worldRanking', csvName: 'w21.csv' },
      ]);
    });

    await waitFor(() => {
      expect(result.current.hook.rows).toHaveLength(2);
    });

    expect(result.current.hook.rows[0]).toMatchObject({ id: 'rule-1', method: 'random' });
    expect(result.current.hook.rows[1]).toMatchObject({ id: 'rule-2', classId: 'W21', csvName: 'w21.csv' });
  });

  it('propagates local edits to the store', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => ({
        hook: useStartOrderSettings(),
        rules: useStartlistStartOrderRules(),
      }),
      { wrapper },
    );

    const initialRowId = result.current.hook.rows[0].id;

    act(() => {
      result.current.hook.handleClassChange(initialRowId, {
        target: { value: ' M21 ' },
      } as unknown as ChangeEvent<HTMLSelectElement>);
      result.current.hook.handleMethodChange(initialRowId, {
        target: { value: 'worldRanking' },
      } as unknown as ChangeEvent<HTMLSelectElement>);
    });

    await waitFor(() => {
      expect(result.current.rules[0]).toMatchObject({ classId: 'M21', method: 'worldRanking' });
    });

    act(() => {
      result.current.hook.handleAddRow();
    });

    await waitFor(() => {
      expect(result.current.rules).toHaveLength(2);
    });

    const nextRowId = result.current.hook.rows[1].id;

    act(() => {
      result.current.hook.handleRemoveRow(nextRowId);
    });

    await waitFor(() => {
      expect(result.current.rules).toHaveLength(1);
    });

    expect(result.current.hook.rows).toHaveLength(1);
  });
});
