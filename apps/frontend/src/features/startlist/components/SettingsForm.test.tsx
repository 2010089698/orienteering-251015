import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import SettingsForm, {
  type SettingsFormChangeHandlers,
  type SettingsFormProps,
} from './SettingsForm';

const createProps = (overrides: Partial<SettingsFormProps> = {}): SettingsFormProps => ({
  fields: {
    eventId: 'event-1',
    startTime: '2024-01-01T09:00',
    laneIntervalMs: 0,
    playerIntervalMs: 60000,
    laneCount: 2,
    avoidConsecutiveClubs: true,
  },
  errors: { form: null },
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
  onChange: {
    eventId: vi.fn(),
    startTime: vi.fn(),
    laneIntervalMs: vi.fn(),
    playerIntervalMs: vi.fn(),
    laneCount: vi.fn(),
    avoidConsecutiveClubs: vi.fn(),
  } satisfies SettingsFormChangeHandlers,
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

    await userEvent.type(screen.getByLabelText(/イベントID（必須）/), '2');
    expect(props.onChange.eventId).toHaveBeenCalledWith('event-12');

    await userEvent.selectOptions(screen.getByLabelText('クラス内選手間隔'), '30000');
    expect(props.onChange.playerIntervalMs).toHaveBeenCalledWith(30000);

    fireEvent.change(screen.getByLabelText('レーン数'), { target: { value: '3' } });
    expect(props.onChange.laneCount).toHaveBeenCalledWith(3);

    await userEvent.click(screen.getByRole('checkbox', { name: /同じ所属が連続で並ばないようにする/ }));
    expect(props.onChange.avoidConsecutiveClubs).toHaveBeenCalledWith(false);
  });
});

