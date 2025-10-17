import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import LaneAssignmentStep from './LaneAssignmentStep';
import { renderWithStartlist } from '../test/test-utils';

const baseSettings = {
  eventId: 'event-1',
  startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
  intervals: {
    laneClass: { milliseconds: 60000 },
    classPlayer: { milliseconds: 45000 },
  },
  laneCount: 2,
};

const laneAssignments = [
  { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
  { laneNumber: 2, classOrder: ['W21'], interval: { milliseconds: 60000 } },
];

const entries = [
  { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '1' },
  { id: 'entry-2', name: 'B', classId: 'W21', cardNo: '2' },
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

  it('switches between overview and focused lane tabs', async () => {
    renderWithStartlist(<LaneAssignmentStep onBack={() => {}} onConfirm={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries,
        laneAssignments,
      },
    });

    const overviewTab = screen.getByRole('tab', { name: 'すべてのレーン' });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    const overviewBoard = screen.getByTestId('lane-board');
    expect(within(overviewBoard).getAllByTestId(/lane-column-/)).toHaveLength(2);

    const laneTwoTab = screen.getByRole('tab', { name: 'レーン 2' });
    await userEvent.click(laneTwoTab);

    const focusedBoard = screen.getByTestId('lane-board');
    const focusedColumns = within(focusedBoard).getAllByTestId(/lane-column-/);
    expect(focusedColumns).toHaveLength(1);
    expect(within(focusedColumns[0]).getByRole('heading', { name: 'レーン 2' })).toBeInTheDocument();
    expect(within(focusedColumns[0]).getByText('W21')).toBeInTheDocument();

    const laneSelect = screen.getByLabelText('W21 のレーン');
    await userEvent.selectOptions(laneSelect, '1');
    expect(await screen.findByText('クラス「W21」をレーン 1 に移動しました。')).toBeInTheDocument();

    await userEvent.click(overviewTab);
    const overviewBoardAfter = screen.getByTestId('lane-board');
    expect(within(overviewBoardAfter).getAllByTestId(/lane-column-/)).toHaveLength(2);
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
