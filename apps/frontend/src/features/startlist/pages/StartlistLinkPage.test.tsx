import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StartlistLinkPage from './StartlistLinkPage';
import { renderWithStartlistRouter } from '../test/test-utils';

const listEventsMock = vi.fn();
const getEventMock = vi.fn();
const createEventMock = vi.fn();
const scheduleRaceMock = vi.fn();

vi.mock('../../event-management/api/useEventManagementApi', () => ({
  useEventManagementApi: () => ({
    listEvents: listEventsMock,
    getEvent: getEventMock,
    createEvent: createEventMock,
    scheduleRace: scheduleRaceMock,
  }),
}));

describe('StartlistLinkPage', () => {
  beforeEach(() => {
    listEventsMock.mockReset();
    getEventMock.mockReset();
    createEventMock.mockReset();
    scheduleRaceMock.mockReset();

    listEventsMock.mockResolvedValue([
      { id: 'event-1', name: '春の大会', startDate: '2024-03-01', endDate: '2024-03-02' },
    ]);

    getEventMock.mockResolvedValue({
      id: 'event-1',
      name: '春の大会',
      races: [
        {
          id: 'race-1',
          name: '本戦',
          schedule: { start: '2024-03-01T02:00:00.000Z', end: undefined },
          duplicateDay: false,
          overlapsExisting: false,
          startlist: { id: 'SL-1', status: 'DRAFT' },
        },
      ],
    });
  });

  it('displays event startlist statuses and management links', async () => {
    const user = userEvent.setup();

    renderWithStartlistRouter(<StartlistLinkPage />, {
      routerProps: { initialEntries: ['/startlist/link'] },
      initialState: { startlistId: 'SL-1' },
    });

    expect(
      await screen.findByRole('heading', { name: 'スタートリストのイベント連携状況' }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(listEventsMock).toHaveBeenCalled();
    });

    await user.selectOptions(await screen.findByLabelText('イベントを選択'), 'event-1');

    await waitFor(() => {
      expect(getEventMock).toHaveBeenCalledWith('event-1');
    });

    expect(await screen.findByText('ID: SL-1')).toBeInTheDocument();
    expect(screen.getByText('状態: 下書き')).toBeInTheDocument();
    const links = await screen.findAllByRole('link', { name: 'スタートリストを編集' });
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/startlist?eventId=event-1');
    expect(hrefs).toContain('/startlist?eventId=event-1&raceId=race-1');
  });

  it('shows success status when the startlist was linked automatically', async () => {
    renderWithStartlistRouter(<StartlistLinkPage />, {
      routerProps: { initialEntries: ['/startlist/link'] },
      initialState: {
        startlistId: 'SL-1',
        eventContext: { eventId: 'event-1', raceId: 'race-1' },
        eventLinkStatus: {
          status: 'success',
          eventId: 'event-1',
          raceId: 'race-1',
          startlistId: 'SL-1',
          startlistLink: 'https://example.com/startlists/SL-1',
        },
      },
    });

    expect(
      await screen.findByText('イベント「春の大会」にスタートリストを自動連携しました。'),
    ).toBeInTheDocument();
    const eventLink = screen.getByRole('link', { name: 'イベント詳細を開く' });
    expect(eventLink).toHaveAttribute('href', '/events/event-1');
  });
});
