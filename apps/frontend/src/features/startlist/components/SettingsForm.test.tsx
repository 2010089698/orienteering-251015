import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import SettingsForm, { type SettingsFormProps } from './SettingsForm';

const createProps = (overrides: Partial<SettingsFormProps> = {}): SettingsFormProps => ({
  startTime: '2024-01-01T09:00',
  laneIntervalMs: 0,
  playerIntervalMs: 60000,
  laneCount: 2,
  avoidConsecutiveClubs: true,
  laneIntervalOptions: [
    { label: '1分', value: 60000 },
    { label: 'なし', value: 0 },
    { label: '30秒', value: 30000 },
  ],
  playerIntervalOptions: [
    { label: '1分', value: 60000 },
    { label: '30秒', value: 30000 },
  ],
  status: { level: 'idle', text: '' },
  onStartTimeChange: vi.fn(),
  onLaneIntervalChange: vi.fn(),
  onPlayerIntervalChange: vi.fn(),
  onLaneCountChange: vi.fn(),
  onAvoidConsecutiveClubsChange: vi.fn(),
  onSubmit: vi.fn(),
  ...overrides,
});

describe('SettingsForm', () => {
  it('renders lane interval options sorted by value', () => {
    const props = createProps();
    render(<SettingsForm {...props} />);

    const laneIntervalSelect = screen.getByLabelText('レーン内クラス間隔') as HTMLSelectElement;
    const options = Array.from(laneIntervalSelect.querySelectorAll('option'));

    expect(options.map((option) => option.value)).toEqual(['0', '30000', '60000']);
  });

  it('delegates form submission to the provided callback', () => {
    const props = createProps();
    const { container } = render(<SettingsForm {...props} />);

    const form = container.querySelector('form');
    if (!form) {
      throw new Error('フォームが見つかりません');
    }

    fireEvent.submit(form);

    expect(props.onSubmit).toHaveBeenCalled();
  });

  it('notifies when field values change', async () => {
    const props = createProps();
    render(<SettingsForm {...props} />);

    await userEvent.selectOptions(screen.getByLabelText('クラス内選手間隔'), '30000');
    expect(props.onPlayerIntervalChange).toHaveBeenCalledWith(30000);

    fireEvent.change(screen.getByLabelText('レーン数'), { target: { value: '3' } });
    expect(props.onLaneCountChange).toHaveBeenCalledWith(3);

    await userEvent.click(screen.getByRole('checkbox', { name: /同じ所属が連続で並ばないようにする/ }));
    expect(props.onAvoidConsecutiveClubsChange).toHaveBeenCalledWith(false);
  });
});

