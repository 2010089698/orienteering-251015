import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ClassOrderStep from './ClassOrderStep';
import { renderWithStartlist } from '../test/test-utils';

const settings = {
  eventId: 'event-1',
  startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
  intervals: {
    laneClass: { milliseconds: 60000 },
    classPlayer: { milliseconds: 60000 },
  },
  laneCount: 1,
};

const laneAssignments = [{ laneNumber: 1, classOrder: ['M21', 'W21'], interval: { milliseconds: 60000 } }];

const classAssignments = [
  { classId: 'M21', playerOrder: ['entry-1', 'entry-2'], interval: { milliseconds: 60000 } },
  { classId: 'W21', playerOrder: ['entry-3'], interval: { milliseconds: 60000 } },
];

const entries = [
  { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '1' },
  { id: 'entry-2', name: 'B', classId: 'M21', cardNo: '2' },
  { id: 'entry-3', name: 'C', classId: 'W21', cardNo: '3' },
];

const startTimes = [
  { playerId: 'entry-1', startTime: new Date('2024-01-01T09:00:00Z').toISOString(), laneNumber: 1 },
  { playerId: 'entry-2', startTime: new Date('2024-01-01T09:01:00Z').toISOString(), laneNumber: 1 },
  { playerId: 'entry-3', startTime: new Date('2024-01-01T09:02:00Z').toISOString(), laneNumber: 1 },
];

describe('ClassOrderStep', () => {
  it('reorders players and recalculates times', async () => {
    renderWithStartlist(<ClassOrderStep onBack={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings,
        laneAssignments,
        classAssignments,
        entries,
        startTimes,
      },
    });

    const m21Tab = screen.getByRole('tab', { name: /M21/ });
    await userEvent.click(m21Tab);

    const downButton = screen.getAllByRole('button', { name: '↓' })[0];
    await userEvent.click(downButton);

    expect(await screen.findByText('順番を更新しました。')).toBeInTheDocument();
    expect(await screen.findByText('スタート時間を再計算しました。')).toBeInTheDocument();
  });

  it('switches between overview and class tabs correctly', async () => {
    renderWithStartlist(<ClassOrderStep onBack={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings,
        laneAssignments,
        classAssignments,
        entries,
        startTimes,
      },
    });

    const overviewTab = screen.getByRole('tab', { name: '一覧' });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    const overviewTable = screen.getByRole('table', { name: 'スタート時間一覧' });
    expect(overviewTable).toBeInTheDocument();

    const initialPanels = screen.getAllByRole('tabpanel', { hidden: true });
    const w21Panel = initialPanels.find((panel) => panel.id.includes('class-w21'));
    expect(w21Panel).toBeDefined();
    expect(w21Panel).toHaveAttribute('hidden');

    const m21Tab = screen.getByRole('tab', { name: /M21/ });
    await userEvent.click(m21Tab);

    expect(m21Tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('table', { name: 'スタート時間一覧' })).not.toBeInTheDocument();

    const activePanels = screen.getAllByRole('tabpanel', { hidden: true });
    const m21Panel = activePanels.find((panel) => panel.id.includes('class-m21'));
    expect(m21Panel).toBeDefined();
    expect(m21Panel).not.toHaveAttribute('hidden');
    expect(w21Panel).toHaveAttribute('hidden');

    expect(screen.getByRole('table', { name: 'M21 のスタート時間' })).toBeInTheDocument();

    await userEvent.click(overviewTab);
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('table', { name: 'スタート時間一覧' })).toBeInTheDocument();
  });
});
