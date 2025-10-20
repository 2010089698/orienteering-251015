import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithStartlist } from '../../test/test-utils';
import { useSettingsForm, type UseSettingsFormReturn } from '../useSettingsForm';

describe('useSettingsForm', () => {
  const renderHook = (options?: Parameters<typeof renderWithStartlist>[1]) => {
    let current: UseSettingsFormReturn | undefined;

    const Harness = () => {
      current = useSettingsForm();
      return null;
    };

    const result = renderWithStartlist(<Harness />, options);

    if (!current) {
      throw new Error('Hook did not initialise');
    }

    return {
      ...result,
      get current() {
        return current!;
      },
    };
  };

  it('returns default values and persists settings when valid', () => {
    const hook = renderHook({
      initialState: {
        settings: undefined,
      },
    });

    expect(hook.current.fields.laneIntervalMs).toBe(0);
    expect(hook.current.fields.avoidConsecutiveClubs).toBe(true);

    act(() => {
      hook.current.onChange.startTime('2024-01-01T09:00');
      hook.current.onChange.laneCount(3);
    });

    act(() => {
      const result = hook.current.submit();
      expect(result.settings).toBeDefined();
      expect(result.settings?.intervals.laneClass.milliseconds).toBe(0);
    });

    expect(hook.current.status.level).toBe('success');
    expect(hook.current.status.text).toBe('基本情報を保存しました。');
    expect(hook.current.errors.form).toBeNull();
  });

  it('returns validation error when required values are missing', () => {
    const hook = renderHook();

    act(() => {
      hook.current.onChange.startTime('');
    });

    act(() => {
      const result = hook.current.submit();
      expect(result.settings).toBeUndefined();
      expect(result.error).toBe('開始時刻を入力してください。');
    });

    expect(hook.current.status.level).toBe('error');
    expect(hook.current.errors.form).toBe('開始時刻を入力してください。');
  });

  it('hydrates new settings state via a single dispatch', () => {
    const hook = renderHook({
      initialState: {
        settings: {
          eventId: 'event-1',
          startTime: new Date('2024-02-01T00:00:00Z').toISOString(),
          laneCount: 4,
          intervals: {
            laneClass: { milliseconds: 120000 },
            classPlayer: { milliseconds: 60000 },
          },
        },
        classOrderPreferences: { avoidConsecutiveClubs: false },
      },
    });

    expect(hook.current.fields.startTime).toBe('2024-02-01T09:00');
    expect(hook.current.fields.laneCount).toBe(4);
    expect(hook.current.fields.avoidConsecutiveClubs).toBe(false);
  });
});

