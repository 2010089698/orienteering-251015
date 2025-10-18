import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ClassOrderStep from './ClassOrderStep';
import { renderWithStartlist } from '../test/test-utils';
import { downloadStartlistCsv } from '../utils/startlistExport';

vi.mock('../utils/startlistExport', () => ({
  downloadStartlistCsv: vi.fn(),
}));

const downloadStartlistCsvMock = downloadStartlistCsv as vi.MockedFunction<typeof downloadStartlistCsv>;

beforeEach(() => {
  downloadStartlistCsvMock.mockReset();
});

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
  { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '1', club: 'Alpha OC' },
  { id: 'entry-2', name: 'B', classId: 'M21', cardNo: '2', club: 'Beta OC' },
  { id: 'entry-3', name: 'C', classId: 'W21', cardNo: '3', club: 'Gamma OC' },
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

  it('orders tabs by lane assignment and switches between class views', async () => {
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

    expect(screen.queryByRole('tab', { name: '一覧' })).not.toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveTextContent('M21');
    expect(tabs[0]).toHaveTextContent('レーン1');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    const initialTable = screen.getByRole('table', { name: 'M21（レーン1）のスタートリスト' });
    expect(initialTable).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveTextContent('スタート時刻');
    expect(headers.some((header) => header.textContent === 'レーン')).toBe(false);

    const w21Tab = screen.getByRole('tab', { name: /W21/ });
    await userEvent.click(w21Tab);

    expect(w21Tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('table', { name: 'M21（レーン1）のスタートリスト' })).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'W21（レーン1）のスタートリスト' })).toBeInTheDocument();
  });

  it('allows exporting CSV from the step actions row', async () => {
    downloadStartlistCsvMock.mockReturnValue(3);

    renderWithStartlist(<ClassOrderStep onBack={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings,
        laneAssignments,
        classAssignments,
        entries,
        startTimes,
        statuses: { startTimes: { level: 'idle', text: '' }, classes: { level: 'idle', text: '' } },
      },
    });

    const exportButton = screen.getByRole('button', { name: 'CSV をエクスポート' });
    expect(exportButton).toBeEnabled();

    await userEvent.click(exportButton);

    expect(downloadStartlistCsvMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('3 件のスタート時間をエクスポートしました。')).toBeInTheDocument();
  });

  it('disables the export button when start times are unavailable', async () => {
    renderWithStartlist(<ClassOrderStep onBack={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings,
        laneAssignments,
        classAssignments,
        entries,
        startTimes: [],
        statuses: { startTimes: { level: 'idle', text: '' }, classes: { level: 'idle', text: '' } },
      },
    });

    const exportButton = screen.getByRole('button', { name: 'CSV をエクスポート' });
    expect(exportButton).toBeDisabled();
  });

  it('shows warnings when consecutive club assignments exist', () => {
    renderWithStartlist(<ClassOrderStep onBack={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings,
        laneAssignments,
        classAssignments,
        entries,
        startTimes,
        classOrderWarnings: [
          {
            classId: 'M21',
            occurrences: [
              { previousPlayerId: 'entry-1', nextPlayerId: 'entry-2', clubs: ['Alpha OC'] },
            ],
          },
        ],
      },
    });

    expect(
      screen.getByText('人数の組み合わせの都合で所属が連続するクラスがあります。下記をご確認ください。'),
    ).toBeInTheDocument();
    expect(screen.getByText('M21（Alpha OC）')).toBeInTheDocument();
  });
});
