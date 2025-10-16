import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import InputStep from './InputStep';
import { renderWithStartlist } from '../test/test-utils';

const baseSettings = {
  eventId: 'event-1',
  startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
  interval: { milliseconds: 60000 },
  laneCount: 2,
};

const sampleEntries = [
  { name: 'A', classId: 'M21', cardNo: '1' },
  { name: 'B', classId: 'W21', cardNo: '2' },
];

describe('InputStep', () => {
  it('blocks progress when information is missing', async () => {
    renderWithStartlist(<InputStep onComplete={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));

    expect(await screen.findByText('基本情報を保存してから進んでください。')).toBeInTheDocument();
  });

  it('generates lane assignments and calls onComplete', async () => {
    let completed = false;
    renderWithStartlist(<InputStep onComplete={() => (completed = true)} />, {
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries: sampleEntries,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));

    expect(await screen.findByText('自動でレーン割り当てを作成しました。')).toBeInTheDocument();
    expect(completed).toBe(true);
  });
});
