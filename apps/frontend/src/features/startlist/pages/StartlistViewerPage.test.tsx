import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import type { StartlistWithHistoryDto } from '@startlist-management/application';

import StartlistViewerPage from './StartlistViewerPage';
import { useStartlistApi } from '../api/useStartlistApi';
import { renderWithStartlistRouter } from '../test/test-utils';

vi.mock('../api/useStartlistApi');

const mockedUseStartlistApi = vi.mocked(useStartlistApi);

const createSnapshot = (overrides: Partial<StartlistWithHistoryDto> = {}): StartlistWithHistoryDto => ({
  id: 'SL-1',
  eventId: 'event-1',
  raceId: 'race-1',
  status: 'FINALIZED',
  settings: {
    eventId: 'event-1',
    startTime: '2024-04-05T09:00:00.000Z',
    laneCount: 3,
    intervals: {
      laneClass: { milliseconds: 120_000 },
      classPlayer: { milliseconds: 60_000 },
    },
  },
  laneAssignments: [],
  classAssignments: [],
  startTimes: [
    { playerId: 'P-1', laneNumber: 1, startTime: '2024-04-05T09:00:00.000Z' },
    { playerId: 'P-2', laneNumber: 2, startTime: '2024-04-05T09:02:00.000Z' },
    { playerId: 'P-3', laneNumber: 3, startTime: '2024-04-05T09:04:00.000Z' },
  ],
  versions: [
    { version: 5, confirmedAt: '2024-04-05T09:12:00.000Z' },
    { version: 4, confirmedAt: '2024-04-04T09:10:00.000Z' },
  ],
  ...overrides,
});

describe('StartlistViewerPage', () => {
  beforeEach(() => {
    mockedUseStartlistApi.mockReset();
  });

  it('loads and renders the full startlist snapshot', async () => {
    const snapshot = createSnapshot();
    const fetchSnapshot = vi.fn(async () => snapshot);
    mockedUseStartlistApi.mockReturnValue({
      fetchSnapshot,
    } as unknown as ReturnType<typeof useStartlistApi>);

    renderWithStartlistRouter(
      <Routes>
        <Route path="/startlists/:startlistId" element={<StartlistViewerPage />} />
      </Routes>,
      { routerProps: { initialEntries: ['/startlists/SL-1'] } },
    );

    const table = await screen.findByRole('table', { name: 'スタート順一覧' });
    expect(fetchSnapshot).toHaveBeenCalledWith({ startlistId: 'SL-1', includeVersions: true });
    const rows = within(table).getAllByRole('rowheader');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('1');
    expect(screen.getByText('イベントID')).toBeInTheDocument();
    expect(screen.getByText('event-1')).toBeInTheDocument();
    expect(screen.getByText('レースID')).toBeInTheDocument();
    expect(screen.getByText('race-1')).toBeInTheDocument();
    expect(screen.getByText('公開バージョン')).toBeInTheDocument();
    expect(screen.getByText('v5')).toBeInTheDocument();
    expect(screen.getByText('公開済み')).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => element?.tagName === 'TIME' && element.getAttribute('dateTime') === '2024-04-05T09:12:00.000Z'),
    ).toBeInTheDocument();
  });

  it('shows an error message when the snapshot fails to load', async () => {
    const fetchSnapshot = vi.fn(async () => {
      throw new Error('取得に失敗しました');
    });
    mockedUseStartlistApi.mockReturnValue({
      fetchSnapshot,
    } as unknown as ReturnType<typeof useStartlistApi>);

    renderWithStartlistRouter(
      <Routes>
        <Route path="/startlists/:startlistId" element={<StartlistViewerPage />} />
      </Routes>,
      { routerProps: { initialEntries: ['/startlists/SL-2'] } },
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('取得に失敗しました');
    await waitFor(() => {
      expect(fetchSnapshot).toHaveBeenCalledWith({ startlistId: 'SL-2', includeVersions: true });
    });
  });
});
