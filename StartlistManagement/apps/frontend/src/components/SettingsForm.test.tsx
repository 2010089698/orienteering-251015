import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import SettingsForm from './SettingsForm';
import { renderWithStartlist } from '../test/test-utils';
import { useStartlistState } from '../state/StartlistContext';

const SnapshotStatusProbe = () => {
  const { statuses } = useStartlistState();
  return <div data-testid="snapshot-status">{statuses.snapshot.text}</div>;
};

describe('SettingsForm', () => {
  it('shows validation errors for missing required fields', async () => {
    renderWithStartlist(
      <>
        <SettingsForm />
        <SnapshotStatusProbe />
      </>,
    );

    await userEvent.type(screen.getByLabelText('スタートリスト ID'), ' ');
    fireEvent.change(screen.getByLabelText('開始時刻'), { target: { value: '2024-01-01T09:00' } });

    await userEvent.click(screen.getByRole('button', { name: '設定を送信' }));

    expect(await screen.findByText('スタートリスト ID を入力してください。')).toBeInTheDocument();
  });

  it('submits settings and updates status when inputs are valid', async () => {
    renderWithStartlist(
      <>
        <SettingsForm />
        <SnapshotStatusProbe />
      </>,
    );

    await userEvent.type(screen.getByLabelText('スタートリスト ID'), 'SL-100');
    await userEvent.type(screen.getByLabelText('イベント ID'), 'event-1');
    fireEvent.change(screen.getByLabelText('開始時刻'), { target: { value: '2024-01-01T09:00' } });
    await userEvent.clear(screen.getByLabelText('インターバル (秒)'));
    await userEvent.type(screen.getByLabelText('インターバル (秒)'), '30');

    await userEvent.click(screen.getByRole('button', { name: '設定を送信' }));

    expect(await screen.findByText('基本情報を保存しました。')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('snapshot-status')).toHaveTextContent('最新スナップショットを取得しました。');
    });
  });

  it('blocks snapshot refresh when startlist id is missing', async () => {
    renderWithStartlist(
      <>
        <SettingsForm />
        <SnapshotStatusProbe />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: '最新スナップショット取得' }));

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-status')).toHaveTextContent('先にスタートリスト ID を設定してください。');
    });
  });
});
