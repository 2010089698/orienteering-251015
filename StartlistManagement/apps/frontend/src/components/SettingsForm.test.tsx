import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import SettingsForm from './SettingsForm';
import { renderWithStartlist } from '../test/test-utils';

describe('SettingsForm', () => {
  it('shows validation errors for missing required fields', async () => {
    renderWithStartlist(<SettingsForm />);

    await userEvent.type(screen.getByLabelText('スタートリスト ID'), ' ');
    fireEvent.change(screen.getByLabelText('開始時刻'), { target: { value: '2024-01-01T09:00' } });

    await userEvent.click(screen.getByRole('button', { name: '基本情報を保存' }));

    expect(await screen.findByText('スタートリスト ID を入力してください。')).toBeInTheDocument();
  });

  it('submits settings and updates status when inputs are valid', async () => {
    renderWithStartlist(<SettingsForm />);

    await userEvent.type(screen.getByLabelText('スタートリスト ID'), 'SL-100');
    await userEvent.type(screen.getByLabelText('大会メモ（任意）'), '春の大会');
    fireEvent.change(screen.getByLabelText('開始時刻'), { target: { value: '2024-01-01T09:00' } });
    await userEvent.clear(screen.getByLabelText('インターバル (秒)'));
    await userEvent.type(screen.getByLabelText('インターバル (秒)'), '30');

    await userEvent.click(screen.getByRole('button', { name: '基本情報を保存' }));

    expect(await screen.findByText('基本情報を保存しました。')).toBeInTheDocument();
  });
});
