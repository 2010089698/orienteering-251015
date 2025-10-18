import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import SettingsForm, { type SettingsFormHandle } from './SettingsForm';
import { renderWithStartlist } from '../test/test-utils';

describe('SettingsForm', () => {
  it('defaults lane interval to "なし" and saves zero milliseconds without requiring a startlist ID', async () => {
    const ref = createRef<SettingsFormHandle>();
    renderWithStartlist(<SettingsForm ref={ref} />);

    expect(screen.queryByLabelText('スタートリスト ID')).not.toBeInTheDocument();

    const laneIntervalSelect = screen.getByLabelText('レーン内クラス間隔') as HTMLSelectElement;
    expect(laneIntervalSelect.value).toBe('0');

    fireEvent.change(screen.getByLabelText('開始時刻'), { target: { value: '2024-01-01T09:00' } });
    await userEvent.selectOptions(screen.getByLabelText('クラス内選手間隔'), '30000');
    fireEvent.change(screen.getByLabelText('レーン数'), { target: { value: '3' } });

    await act(async () => {
      const result = ref.current?.validateAndSave();
      expect(result).not.toBeNull();
      expect(result?.intervals.laneClass.milliseconds).toBe(0);
    });

    expect(await screen.findByText('基本情報を保存しました。')).toBeInTheDocument();
  });

  it('lists the zero interval option labelled 「なし」 first', () => {
    renderWithStartlist(<SettingsForm />);

    const laneIntervalSelect = screen.getByLabelText('レーン内クラス間隔') as HTMLSelectElement;
    const options = Array.from(laneIntervalSelect.querySelectorAll('option'));

    expect(options[0]).toHaveValue('0');
    expect(options[0]).toHaveTextContent('なし');
  });

  it('shows validation errors when required fields are missing', async () => {
    const ref = createRef<SettingsFormHandle>();
    renderWithStartlist(<SettingsForm ref={ref} />);

    await userEvent.clear(screen.getByLabelText('開始時刻'));

    await act(async () => {
      const result = ref.current?.validateAndSave();
      expect(result).toBeNull();
    });

    expect(await screen.findByText('開始時刻を入力してください。')).toBeInTheDocument();
  });
});
