import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import LaneAssignmentStep from './LaneAssignmentStep';
import { renderWithStartlist } from '../test/test-utils';

const baseSettings = {
  eventId: 'event-1',
  startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
  interval: { milliseconds: 60000 },
  laneCount: 2,
};

const laneAssignments = [
  { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
  { laneNumber: 2, classOrder: ['W21'], interval: { milliseconds: 60000 } },
];

const entries = [
  { name: 'A', classId: 'M21', cardNo: '1' },
  { name: 'B', classId: 'W21', cardNo: '2' },
];

describe('LaneAssignmentStep', () => {
  it('allows lane changes', async () => {
    renderWithStartlist(<LaneAssignmentStep onBack={() => {}} onConfirm={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries,
        laneAssignments,
      },
    });

    const select = screen.getByLabelText('M21 のレーン');
    await userEvent.selectOptions(select, '2');
    expect(await screen.findByText('クラス「M21」をレーン 2 に移動しました。')).toBeInTheDocument();
  });

  it('confirms assignments and generates next steps', async () => {
    let confirmed = false;
    renderWithStartlist(<LaneAssignmentStep onBack={() => {}} onConfirm={() => (confirmed = true)} />, {
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries,
        laneAssignments,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: '割り当て確定（順番と時間を作成）' }));

    expect(await screen.findByText('クラス内の順序を自動で作成しました。')).toBeInTheDocument();
    expect(await screen.findByText('スタート時間を割り当てました。')).toBeInTheDocument();
    expect(confirmed).toBe(true);
  });
});
