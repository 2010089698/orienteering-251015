import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import SettingsForm, { type SettingsFormHandle } from './SettingsForm';
import { renderWithStartlist } from '../test/test-utils';

describe('SettingsForm', () => {
  it('provides a default startlist ID and saves settings via the imperative handle', async () => {
    const ref = createRef<SettingsFormHandle>();
    renderWithStartlist(<SettingsForm ref={ref} />);

    const startlistIdInput = screen.getByLabelText('スタートリスト ID') as HTMLInputElement;
    expect(startlistIdInput.value).not.toBe('');

    await userEvent.type(screen.getByLabelText('大会メモ（任意）'), '春の大会');
    fireEvent.change(screen.getByLabelText('開始時刻'), { target: { value: '2024-01-01T09:00' } });
    await userEvent.selectOptions(screen.getByLabelText('レーン内クラス間隔'), '120000');
    await userEvent.selectOptions(screen.getByLabelText('クラス内選手間隔'), '30000');
    fireEvent.change(screen.getByLabelText('レーン数'), { target: { value: '3' } });

    await act(async () => {
      const result = ref.current?.validateAndSave();
      expect(result).not.toBeNull();
    });

    expect(await screen.findByText('基本情報を保存しました。')).toBeInTheDocument();
  });

  it('shows validation errors when required fields are missing', async () => {
    const ref = createRef<SettingsFormHandle>();
    renderWithStartlist(<SettingsForm ref={ref} />);

    const startlistIdInput = screen.getByLabelText('スタートリスト ID');
    await userEvent.clear(startlistIdInput);

    await act(async () => {
      const result = ref.current?.validateAndSave();
      expect(result).toBeNull();
    });

    expect(await screen.findByText('スタートリスト ID を入力してください。')).toBeInTheDocument();
  });
});
