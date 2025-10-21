import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import StartlistLinkPage from './StartlistLinkPage';
import { renderWithStartlistRouter, createSuccessStatus } from '../test/test-utils';

const listEventsMock = vi.fn();
const getEventMock = vi.fn();
const createEventMock = vi.fn();
const scheduleRaceMock = vi.fn();
const attachStartlistMock = vi.fn();

vi.mock('../../event-management/api/useEventManagementApi', () => ({
  useEventManagementApi: () => ({
    listEvents: listEventsMock,
    getEvent: getEventMock,
    createEvent: createEventMock,
    scheduleRace: scheduleRaceMock,
    attachStartlist: attachStartlistMock,
  }),
}));

describe('StartlistLinkPage', () => {
  beforeEach(() => {
    listEventsMock.mockReset();
    getEventMock.mockReset();
    createEventMock.mockReset();
    scheduleRaceMock.mockReset();
    attachStartlistMock.mockReset();

    listEventsMock.mockResolvedValue([
      {
        id: 'event-1',
        name: '春の大会',
        startDate: '2024-03-01',
        endDate: '2024-03-02',
      },
    ]);

    getEventMock.mockResolvedValue({
      id: 'event-1',
      name: '春の大会',
      races: [
        {
          id: 'race-1',
          name: '本戦',
        },
      ],
    });

    attachStartlistMock.mockResolvedValue({
      id: 'event-1',
      name: '春の大会',
      races: [
        {
          id: 'race-1',
          name: '本戦',
          startlistLink: 'https://example.com/startlist',
          startlistUpdatedAt: '2024-04-05T09:00:00.000Z',
          startlistPublicVersion: 6,
        },
      ],
    });
  });

  it('loads events, allows selecting one, and attaches a startlist link', async () => {
    const user = userEvent.setup();

    renderWithStartlistRouter(
      <StartlistLinkPage />, 
      {
        routerProps: {
          initialEntries: ['/startlist/link'],
          initialIndex: 0,
        },
        initialState: {
          startlistId: 'SL-1',
          statuses: {
            snapshot: createSuccessStatus('finalized'),
          },
        },
      },
    );

    expect(await screen.findByRole('heading', { name: 'スタートリストをイベントに連携' })).toBeInTheDocument();

    await waitFor(() => {
      expect(listEventsMock).toHaveBeenCalled();
    });

    const eventSelect = await screen.findByLabelText('イベントを選択');
    await user.selectOptions(eventSelect, 'event-1');

    await waitFor(() => {
      expect(getEventMock).toHaveBeenCalledWith('event-1');
    });

    const raceSelect = await screen.findByLabelText('対象レース');
    await user.selectOptions(raceSelect, 'race-1');

    const urlInput = screen.getByLabelText('スタートリストURL');
    await user.clear(urlInput);
    await user.type(urlInput, 'https://example.com/startlist');

    const submitButton = screen.getByRole('button', { name: 'スタートリストを設定' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(attachStartlistMock).toHaveBeenCalledWith({
        eventId: 'event-1',
        raceId: 'race-1',
        startlistLink: 'https://example.com/startlist',
      });
    });

    expect(listEventsMock).toHaveBeenCalledTimes(2);
    expect(getEventMock).toHaveBeenCalledTimes(2);
  });
});
