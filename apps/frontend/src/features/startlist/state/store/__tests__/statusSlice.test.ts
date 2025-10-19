import { describe, expect, it } from 'vitest';
import { createStatus, createInitialStatusState, statusReducer } from '../statusSlice';

describe('statusSlice', () => {
  it('creates default statuses', () => {
    const state = createInitialStatusState();

    expect(Object.keys(state.statuses)).toContain('entries');
    expect(state.statuses.entries.text).toBe('待機中です。');
    expect(state.loading).toEqual({});
  });

  it('updates statuses and loading flags', () => {
    const initial = createInitialStatusState();

    const withStatus = statusReducer(initial, {
      type: 'status/setStatus',
      payload: { key: 'entries', status: createStatus('ok', 'success') },
    });

    expect(withStatus.statuses.entries.text).toBe('ok');
    expect(withStatus.statuses.entries.level).toBe('success');

    const withLoading = statusReducer(withStatus, {
      type: 'status/setLoading',
      payload: { key: 'entries', value: true },
    });

    expect(withLoading.loading.entries).toBe(true);
  });
});
