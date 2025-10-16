import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ClassOrderStep from './ClassOrderStep';
import { renderWithStartlist } from '../test/test-utils';

const settings = {
  eventId: 'event-1',
  startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
  interval: { milliseconds: 60000 },
  laneCount: 1,
  intervalType: 'player' as const,
};

const laneAssignments = [{ laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } }];

const classAssignments = [
  { classId: 'M21', playerOrder: ['1', '2'], interval: { milliseconds: 60000 } },
];

const entries = [
  { name: 'A', classId: 'M21', cardNo: '1' },
  { name: 'B', classId: 'M21', cardNo: '2' },
];

const startTimes = [
  { playerId: '1', startTime: new Date('2024-01-01T09:00:00Z').toISOString(), laneNumber: 1 },
  { playerId: '2', startTime: new Date('2024-01-01T09:01:00Z').toISOString(), laneNumber: 1 },
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

    const downButton = screen.getAllByRole('button', { name: '↓' })[0];
    await userEvent.click(downButton);

    expect(await screen.findByText('順番を更新しました。')).toBeInTheDocument();
    expect(await screen.findByText('スタート時間を再計算しました。')).toBeInTheDocument();
  });
});
