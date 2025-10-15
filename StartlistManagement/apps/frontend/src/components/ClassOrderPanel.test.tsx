import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ClassOrderPanel from './ClassOrderPanel';
import { renderWithStartlist } from '../test/test-utils';

const settings = {
  eventId: 'event',
  startTime: new Date('2024-01-01T09:00:00.000Z').toISOString(),
  interval: { milliseconds: 60000 },
  laneCount: 2,
};

const entries = [
  { name: 'A', classId: 'M21', cardNo: '1' },
  { name: 'B', classId: 'M21', cardNo: '2' },
  { name: 'C', classId: 'W21', cardNo: '3' },
];

describe('ClassOrderPanel', () => {
  it('requires settings before generation', async () => {
    renderWithStartlist(<ClassOrderPanel />, { initialState: { entries } });

    await userEvent.click(screen.getByRole('button', { name: 'クラス順序を自動生成' }));

    expect(screen.getByText('先に基本情報を入力してください。')).toBeInTheDocument();
  });

  it('generates default assignments and allows manual ordering', async () => {
    renderWithStartlist(<ClassOrderPanel />, {
      initialState: { entries, settings, startlistId: 'SL-1' },
    });

    await userEvent.click(screen.getByRole('button', { name: 'クラス順序を自動生成' }));

    expect(screen.getByText('2 クラスの順序を生成しました。')).toBeInTheDocument();

    const moveDownButtons = screen.getAllByRole('button', { name: '↓' });
    await userEvent.click(moveDownButtons[0]);

    expect(screen.getByText('クラス内順序を更新しました。')).toBeInTheDocument();
  });

  it('persists assignments via API', async () => {
    renderWithStartlist(<ClassOrderPanel />, {
      initialState: { entries, settings, startlistId: 'SL-1' },
    });

    await userEvent.click(screen.getByRole('button', { name: 'クラス順序を自動生成' }));
    await userEvent.click(screen.getByRole('button', { name: 'API に送信' }));

    expect(await screen.findByText('クラス順序を送信しました。')).toBeInTheDocument();
  });
});
