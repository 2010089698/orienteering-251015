import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StartTimesPanel from './StartTimesPanel';
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

const laneAssignments = [
  { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
  { laneNumber: 2, classOrder: ['W21'], interval: { milliseconds: 60000 } },
];

const classAssignments = [
  { classId: 'M21', playerOrder: ['1', '2'], interval: { milliseconds: 60000 } },
  { classId: 'W21', playerOrder: ['3'], interval: { milliseconds: 60000 } },
];

describe('StartTimesPanel', () => {
  it('shows error when inputs are insufficient for calculation', async () => {
    renderWithStartlist(<StartTimesPanel />, {
      initialState: {
        entries,
        settings: { ...settings, interval: { milliseconds: 0 } },
        startlistId: 'SL-1',
        laneAssignments,
        classAssignments,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'スタート時間を再計算' }));

    expect(await screen.findByText('必要なデータが不足しています。')).toBeInTheDocument();
  });

  it('recalculates start times and displays results', async () => {
    renderWithStartlist(<StartTimesPanel />, {
      initialState: {
        entries,
        settings,
        startlistId: 'SL-1',
        laneAssignments,
        classAssignments,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'スタート時間を再計算' }));

    expect(await screen.findByText('3 件のスタート時間を算出しました。')).toBeInTheDocument();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
  });

  it('persists and finalizes start times via API', async () => {
    renderWithStartlist(<StartTimesPanel />, {
      initialState: {
        entries,
        settings,
        startlistId: 'SL-1',
        laneAssignments,
        classAssignments,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'スタート時間を再計算' }));
    await userEvent.click(screen.getByRole('button', { name: 'API に送信' }));
    expect(await screen.findByText('スタート時間を送信しました。')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'スタートリストを確定' }));
    expect(await screen.findByText('スタートリストを確定しました。')).toBeInTheDocument();
  });

  it('invalidates start times when reason provided', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('再計算が必要');

    renderWithStartlist(<StartTimesPanel />, {
      initialState: {
        entries,
        settings,
        startlistId: 'SL-1',
        laneAssignments,
        classAssignments,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'スタート時間を再計算' }));
    await userEvent.click(screen.getByRole('button', { name: 'スタート時間を無効化' }));

    expect(await screen.findByText('スタート時間を無効化しました。')).toBeInTheDocument();
    promptSpy.mockRestore();
  });
});
