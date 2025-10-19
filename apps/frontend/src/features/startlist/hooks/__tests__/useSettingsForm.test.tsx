import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithStartlist } from '../../test/test-utils';
import { useSettingsForm, type UseSettingsFormReturn } from '../useSettingsForm';

describe('useSettingsForm', () => {
  const renderHook = (options?: Parameters<typeof renderWithStartlist>[1]) => {
    let current: UseSettingsFormReturn;

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

    expect(hook.current.laneIntervalMs).toBe(0);
    expect(hook.current.avoidConsecutiveClubs).toBe(true);

    act(() => {
      hook.current.onStartTimeChange('2024-01-01T09:00');
      hook.current.onLaneCountChange(3);
    });

    act(() => {
      const result = hook.current.submit();
      expect(result.settings).toBeDefined();
      expect(result.settings?.intervals.laneClass.milliseconds).toBe(0);
    });

    expect(hook.current.status.level).toBe('success');
    expect(hook.current.status.text).toBe('基本情報を保存しました。');
    expect(hook.current.validationError).toBeNull();
  });

  it('returns validation error when required values are missing', () => {
    const hook = renderHook();

    act(() => {
      hook.current.onStartTimeChange('');
    });

    act(() => {
      const result = hook.current.submit();
      expect(result.settings).toBeUndefined();
      expect(result.error).toBe('開始時刻を入力してください。');
    });

    expect(hook.current.status.level).toBe('error');
    expect(hook.current.validationError).toBe('開始時刻を入力してください。');
  });
});

