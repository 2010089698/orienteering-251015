import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import LaneAssignmentPanel from './LaneAssignmentPanel';
import { renderWithStartlist } from '../test/test-utils';

const baseSettings = {
  eventId: 'event',
  startTime: new Date('2024-01-01T09:00:00.000Z').toISOString(),
  interval: { milliseconds: 60000 },
  laneCount: 2,
};

const singleLaneSettings = { ...baseSettings, laneCount: 1 };

const sampleEntries = [
  { name: 'A', classId: 'M21', cardNo: '1' },
  { name: 'B', classId: 'W21', cardNo: '2' },
  { name: 'C', classId: 'M18', cardNo: '3' },
];

describe('LaneAssignmentPanel', () => {
  it('requires settings before generating assignments', async () => {
    renderWithStartlist(<LaneAssignmentPanel />, {
      initialState: { entries: sampleEntries },
    });

    await userEvent.click(screen.getByRole('button', { name: 'レーン割り当てを自動生成' }));

    expect(screen.getByText('先に基本情報を保存してください。')).toBeInTheDocument();
  });

  it('generates assignments and allows reordering', async () => {
    renderWithStartlist(<LaneAssignmentPanel />, {
      initialState: {
        entries: sampleEntries,
        startlistId: 'SL-1',
        settings: singleLaneSettings,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'レーン割り当てを自動生成' }));

    expect(screen.getByText(/レーン割り当てを生成しました。/)).toBeInTheDocument();

    const moveDown = screen.getAllByRole('button', { name: '↓' })[0];
    await userEvent.click(moveDown);

    expect(screen.getByText('クラス順序を更新しました。')).toBeInTheDocument();
  });

  it('sends assignments to API when startlist id is set', async () => {
    renderWithStartlist(<LaneAssignmentPanel />, {
      initialState: {
        entries: sampleEntries,
        startlistId: 'SL-1',
        settings: baseSettings,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'レーン割り当てを自動生成' }));
    await userEvent.click(screen.getByRole('button', { name: 'API に送信' }));

    expect(await screen.findByText('レーン割り当てを送信しました。')).toBeInTheDocument();
  });
});
