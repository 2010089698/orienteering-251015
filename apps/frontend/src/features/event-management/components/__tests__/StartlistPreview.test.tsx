import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { StartlistWithHistoryDto } from '@startlist-management/application';

import StartlistPreview from '../StartlistPreview';
import { useStartlistApi } from '../../../startlist/api/useStartlistApi';

vi.mock('../../../startlist/api/useStartlistApi');

const mockedUseStartlistApi = vi.mocked(useStartlistApi);

const createSnapshot = (overrides: Partial<StartlistWithHistoryDto> = {}): StartlistWithHistoryDto => ({
  id: 'SL-1',
  status: 'FINALIZED',
  settings: {
    eventId: 'event-1',
    startTime: '2024-04-05T09:00:00.000Z',
    intervals: {
      laneClass: { milliseconds: 120_000 },
      classPlayer: { milliseconds: 60_000 },
    },
    laneCount: 3,
  },
  laneAssignments: [],
  classAssignments: [],
  startTimes: [
    { playerId: 'P-3', laneNumber: 3, startTime: '2024-04-05T09:04:00.000Z' },
    { playerId: 'P-2', laneNumber: 2, startTime: '2024-04-05T09:02:00.000Z' },
    { playerId: 'P-1', laneNumber: 1, startTime: '2024-04-05T09:00:00.000Z' },
    { playerId: 'P-4', laneNumber: 1, startTime: '2024-04-05T09:06:00.000Z' },
    { playerId: 'P-5', laneNumber: 2, startTime: '2024-04-05T09:08:00.000Z' },
    { playerId: 'P-6', laneNumber: 3, startTime: '2024-04-05T09:10:00.000Z' },
  ],
  versions: [
    { version: 5, confirmedAt: '2024-04-05T09:12:00.000Z' },
    { version: 4, confirmedAt: '2024-04-04T09:12:00.000Z' },
  ],
  ...overrides,
});

describe('StartlistPreview', () => {
  beforeEach(() => {
    mockedUseStartlistApi.mockReset();
  });

  it('loads and displays a compact snapshot summary', async () => {
    const snapshot = createSnapshot();
    const fetchSnapshot = vi.fn(async () => snapshot);
    mockedUseStartlistApi.mockReturnValue({
      fetchSnapshot,
    } as unknown as ReturnType<typeof useStartlistApi>);

    render(<StartlistPreview startlistId="SL-1" initialStatus="FINALIZED" />);

    const table = await screen.findByRole('table', { name: 'スタートリストのプレビュー' });
    expect(table).toBeInTheDocument();
    expect(fetchSnapshot).toHaveBeenCalledWith({ startlistId: 'SL-1', includeVersions: true, versionLimit: 1 });
    expect(screen.getByText('ID: SL-1')).toBeInTheDocument();
    expect(screen.getByText('公開バージョン v5')).toBeInTheDocument();
    expect(screen.getByText('レーン数: 3')).toBeInTheDocument();
    expect(screen.getByText('確定スタート数: 6')).toBeInTheDocument();
    expect(screen.getByText('P-1')).toBeInTheDocument();
    expect(screen.getByText('P-3')).toBeInTheDocument();
    expect(screen.getByText('ほか 1 件のスタートがあります。')).toBeInTheDocument();
  });

  it('renders an error message when fetching fails', async () => {
    const fetchSnapshot = vi.fn(async () => {
      throw new Error('取得に失敗しました');
    });
    mockedUseStartlistApi.mockReturnValue({
      fetchSnapshot,
    } as unknown as ReturnType<typeof useStartlistApi>);

    render(<StartlistPreview startlistId="SL-2" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('取得に失敗しました');
  });

  it('re-fetches the snapshot when the startlist identifier changes', async () => {
    const snapshot = createSnapshot();
    const fetchSnapshot = vi.fn(async () => snapshot);
    mockedUseStartlistApi.mockReturnValue({
      fetchSnapshot,
    } as unknown as ReturnType<typeof useStartlistApi>);

    const { rerender } = render(<StartlistPreview startlistId="SL-1" />);

    await screen.findByRole('table', { name: 'スタートリストのプレビュー' });
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);

    fetchSnapshot.mockClear();

    rerender(<StartlistPreview startlistId="SL-2" />);

    await waitFor(() => {
      expect(fetchSnapshot).toHaveBeenCalledWith({
        startlistId: 'SL-2',
        includeVersions: true,
        versionLimit: 1,
      });
    });
  });
});
