import { describe, expect, it } from 'vitest';
import {
  entriesReducer,
  initialEntriesState,
  type EntriesAction,
} from '../entriesSlice';

const reduce = (action: EntriesAction) => entriesReducer(initialEntriesState, action);

describe('entriesSlice', () => {
  it('adds entries with generated ids when missing', () => {
    const state = reduce({
      type: 'entries/add',
      payload: { name: 'Runner', classId: 'M21', cardNo: '1' },
    });

    expect(state).toHaveLength(1);
    expect(state[0]?.id).toBeTruthy();
  });

  it('removes entries by id', () => {
    const withEntry = reduce({
      type: 'entries/add',
      payload: { id: 'entry-1', name: 'Runner', classId: 'M21', cardNo: '1' },
    });

    const next = entriesReducer(withEntry, {
      type: 'entries/remove',
      payload: { id: 'entry-1' },
    });

    expect(next).toHaveLength(0);
  });

  it('replaces entries when update action is dispatched', () => {
    const withEntry = reduce({
      type: 'entries/add',
      payload: { id: 'entry-1', name: 'Runner', classId: 'M21', cardNo: '1' },
    });

    const entry = withEntry[0];
    if (!entry) {
      throw new Error('entry is not available');
    }

    const updated = entriesReducer(withEntry, {
      type: 'entries/update',
      payload: { ...entry, name: 'Updated Runner', cardNo: '2' },
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]?.name).toBe('Updated Runner');
    expect(updated[0]?.cardNo).toBe('2');
  });

  it('ensures ids when replacing entries', () => {
    const next = reduce({
      type: 'entries/set',
      payload: [
        { id: 'existing', name: 'Existing', classId: 'M21', cardNo: '1' },
        { name: 'New', classId: 'W21', cardNo: '2' },
      ],
    });

    expect(next).toHaveLength(2);
    expect(next[0]?.id).toBe('existing');
    expect(next[1]?.id).toBeDefined();
    expect(next[1]?.id).not.toBe('existing');
  });
});
