import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import StartOrderSettingsPanel from '../StartOrderSettingsPanel';
import ClassOrderPanel from '../ClassOrderPanel';
import { renderWithStartlist } from '../../test/test-utils';
import { useStartlistStartOrderRules } from '../../state/StartlistContext';

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
    renderWithStartlist(
      <>
        <StartOrderSettingsPanel />
        <StartOrderRulesPreview />
      </>,
      {
        initialState: { entries, settings: baseSettings, startlistId: 'SL-1' },
      },
    );

    expect(
      await screen.findByText('世界ランキング対象クラスを選択していません。'),
    ).toBeInTheDocument();

    const classSelect = screen.getByLabelText('対象クラス');
    await userEvent.selectOptions(classSelect, 'M21');

    const methodSelect = screen.getByLabelText('リスト方式');
    await userEvent.selectOptions(methodSelect, 'worldRanking');

    const fileInput = await screen.findByLabelText('世界ランキング CSV');
    expect(screen.getByText('CSV を読み込んでください。')).toBeInTheDocument();
    const csv = ['Rank,Name,IOF ID', '1,Runner One,IOF001', '2,Runner Two,IOF002'].join('\n');
    const file = new File([csv], 'wr.csv', { type: 'text/csv' });

    await userEvent.upload(fileInput, file);

    expect(
      await screen.findByText('クラス M21 の世界ランキングを 2 件読み込みました。'),
    ).toBeInTheDocument();
    expect(await screen.findByText('読み込み済み: wr.csv')).toBeInTheDocument();
  });

  it('shows an error when the CSV cannot be parsed', async () => {
    renderWithStartlist(
      <>
        <StartOrderSettingsPanel />
        <StartOrderRulesPreview />
      </>,
      {
        initialState: { entries, settings: baseSettings, startlistId: 'SL-1' },
      },
    );

    const classSelect = screen.getByLabelText('対象クラス');
    await userEvent.selectOptions(classSelect, 'M21');

    const methodSelect = screen.getByLabelText('リスト方式');
    await userEvent.selectOptions(methodSelect, 'worldRanking');

    const fileInput = await screen.findByLabelText('世界ランキング CSV');
    const invalidCsv = ['Rank,Name', '1,Runner One'].join('\n');
    const file = new File([invalidCsv], 'invalid.csv', { type: 'text/csv' });

    await userEvent.upload(fileInput, file);

    expect(
      await screen.findByText('世界ランキング CSV に必要な列 (IOF ID, Rank) が見つかりません。'),
    ).toBeInTheDocument();
    expect(screen.getByText('CSV を読み込んでください。')).toBeInTheDocument();
  });

    it('tracks separate CSV uploads for multiple world ranking classes', async () => {
      renderWithStartlist(
        <>
          <StartOrderSettingsPanel />
        <StartOrderRulesPreview />
      </>,
      {
        initialState: { entries, settings: baseSettings, startlistId: 'SL-1' },
      },
    );

    const firstClassSelect = screen.getByLabelText('対象クラス');
    await userEvent.selectOptions(firstClassSelect, 'M21');
    const firstMethodSelect = screen.getAllByLabelText('リスト方式')[0];
    await userEvent.selectOptions(firstMethodSelect, 'worldRanking');
    const firstFileInput = screen.getAllByLabelText('世界ランキング CSV')[0];
    const firstCsv = ['Rank,Name,IOF ID', '1,Runner One,IOF001'].join('\n');
    await userEvent.upload(firstFileInput, new File([firstCsv], 'm21.csv', { type: 'text/csv' }));
    expect(await screen.findByText('読み込み済み: m21.csv')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '行を追加' }));

    const updatedClassSelects = await screen.findAllByLabelText('対象クラス');
    await userEvent.selectOptions(updatedClassSelects[1], 'W21');
    const methodSelects = await screen.findAllByLabelText('リスト方式');
    await userEvent.selectOptions(methodSelects[1], 'worldRanking');

    await screen.findByText('CSV を読み込んでください。');
    const fileInputs = screen.getAllByLabelText('世界ランキング CSV');
    expect(fileInputs).toHaveLength(2);
    expect(await screen.findByText('CSV を読み込んでください。')).toBeInTheDocument();

    const secondCsv = ['Rank,Name,IOF ID', '1,Runner One,IOF101'].join('\n');
    await userEvent.upload(fileInputs[1], new File([secondCsv], 'w21.csv', { type: 'text/csv' }));

    await screen.findByText('クラス W21 の世界ランキングを 1 件読み込みました。');
    const rulesPreview = screen.getByTestId('start-order-rules').textContent ?? '';
    expect(rulesPreview).toContain('"classId":"M21"');
    expect(rulesPreview).toContain('"csvName":"m21.csv"');
    expect(rulesPreview).toContain('"classId":"W21"');
    expect(rulesPreview).toContain('"csvName":"w21.csv"');
  });
});

describe('ClassOrderPanel and start order status', () => {
  it('requires a world ranking file when target classes are selected', async () => {
    renderWithStartlist(<ClassOrderPanel />, {
      initialState: {
        entries,
        settings: baseSettings,
        startlistId: 'SL-1',
        startOrderRules: [{ id: 'rule-1', classId: 'M21', method: 'worldRanking' }],
      },
    });

    const generateButton = screen.getByRole('button', { name: 'クラス順序を自動生成' });
    await userEvent.click(generateButton);

    expect(
      await screen.findByText('世界ランキング方式のクラス (M21) の CSV が読み込まれていません。'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('世界ランキングの CSV を読み込んでからクラス順序を生成してください。'),
    ).toBeInTheDocument();
  });

  it('lists all world ranking classes missing CSV files', async () => {
    renderWithStartlist(<ClassOrderPanel />, {
      initialState: {
        entries,
        settings: baseSettings,
        startlistId: 'SL-1',
        startOrderRules: [
          { id: 'rule-1', classId: 'M21', method: 'worldRanking' },
          { id: 'rule-2', classId: 'W21', method: 'worldRanking' },
        ],
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'クラス順序を自動生成' }));

    expect(
      await screen.findByText('世界ランキング方式のクラス (M21, W21) の CSV が読み込まれていません。'),
    ).toBeInTheDocument();
  });
});
const StartOrderRulesPreview = () => {
  const startOrderRules = useStartlistStartOrderRules();
  return <pre data-testid="start-order-rules">{JSON.stringify(startOrderRules)}</pre>;
};
