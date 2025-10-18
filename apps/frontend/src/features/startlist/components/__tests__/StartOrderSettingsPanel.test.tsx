import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import StartOrderSettingsPanel from '../StartOrderSettingsPanel';
import ClassOrderPanel from '../ClassOrderPanel';
import { renderWithStartlist } from '../../test/test-utils';

const entries = [
  { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '1' },
  { id: 'entry-2', name: 'B', classId: 'W21', cardNo: '2' },
];

const baseSettings = {
  eventId: 'event-1',
  startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
  intervals: {
    laneClass: { milliseconds: 60000 },
    classPlayer: { milliseconds: 60000 },
  },
  laneCount: 2,
};

describe('StartOrderSettingsPanel', () => {
  it('allows configuring world ranking classes and uploading CSV data', async () => {
    renderWithStartlist(<StartOrderSettingsPanel />, {
      initialState: { entries, settings: baseSettings, startlistId: 'SL-1' },
    });

    expect(
      await screen.findByText('世界ランキング対象クラスを選択していません。'),
    ).toBeInTheDocument();

    expect(screen.queryByLabelText('世界ランキングファイル (CSV)')).not.toBeInTheDocument();

    const classSelect = screen.getByLabelText('対象クラス');
    await userEvent.selectOptions(classSelect, 'M21');

    const methodSelect = screen.getByLabelText('リスト方式');
    await userEvent.selectOptions(methodSelect, 'worldRanking');

    const fileInput = await screen.findByLabelText('世界ランキングファイル (CSV)');
    const csv = ['Rank,Name,IOF ID', '1,Runner One,IOF001', '2,Runner Two,IOF002'].join('\n');
    const file = new File([csv], 'wr.csv', { type: 'text/csv' });

    await userEvent.upload(fileInput, file);

    expect(
      await screen.findByText('世界ランキングを 2 件読み込みました。'),
    ).toBeInTheDocument();
  });

  it('shows an error when the CSV cannot be parsed', async () => {
    renderWithStartlist(<StartOrderSettingsPanel />, {
      initialState: { entries, settings: baseSettings, startlistId: 'SL-1' },
    });

    const classSelect = screen.getByLabelText('対象クラス');
    await userEvent.selectOptions(classSelect, 'M21');

    const methodSelect = screen.getByLabelText('リスト方式');
    await userEvent.selectOptions(methodSelect, 'worldRanking');

    const fileInput = await screen.findByLabelText('世界ランキングファイル (CSV)');
    const invalidCsv = ['Rank,Name', '1,Runner One'].join('\n');
    const file = new File([invalidCsv], 'invalid.csv', { type: 'text/csv' });

    await userEvent.upload(fileInput, file);

    expect(
      await screen.findByText('世界ランキング CSV に必要な列 (IOF ID, Rank) が見つかりません。'),
    ).toBeInTheDocument();
  });
});

describe('ClassOrderPanel and start order status', () => {
  it('requires a world ranking file when target classes are selected', async () => {
    renderWithStartlist(<ClassOrderPanel />, {
      initialState: {
        entries,
        settings: baseSettings,
        startlistId: 'SL-1',
        worldRankingTargetClassIds: ['M21'],
      },
    });

    const generateButton = screen.getByRole('button', { name: 'クラス順序を自動生成' });
    await userEvent.click(generateButton);

    const message =
      '世界ランキングファイルを読み込んでからクラス順序を生成してください。';
    expect(await screen.findAllByText(message)).toHaveLength(2);
  });
});
