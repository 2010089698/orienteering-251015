import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import StartlistLinkPage from './StartlistLinkPage';
import { renderWithStartlistRouter, createSuccessStatus } from '../test/test-utils';

const listEventsMock = vi.fn();
const getEventMock = vi.fn();
const createEventMock = vi.fn();
const scheduleRaceMock = vi.fn();
const attachStartlistMock = vi.fn();

const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;
let previousPublicBaseUrl: string | undefined;

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
    previousPublicBaseUrl = env.VITE_STARTLIST_PUBLIC_BASE_URL;
    env.VITE_STARTLIST_PUBLIC_BASE_URL = undefined;
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
      event: {
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
      },
      startlistId: 'SL-1',
    });
  });

  afterEach(() => {
    env.VITE_STARTLIST_PUBLIC_BASE_URL = previousPublicBaseUrl;
  });

  it('links the finalized startlist automatically when available', async () => {
    const user = userEvent.setup();
    env.VITE_STARTLIST_PUBLIC_BASE_URL = 'https://public.example.com';

    renderWithStartlistRouter(
      <StartlistLinkPage />,
      {
        routerProps: {
          initialEntries: ['/startlist/link'],
          initialIndex: 0,
        },
        initialState: {
          startlistId: 'SL-1',
          snapshot: {
            id: 'SL-1',
            status: 'FINALIZED',
            laneAssignments: [],
            classAssignments: [],
            startTimes: [],
          },
          versionHistory: [
            { version: 3, confirmedAt: '2024-04-05T09:00:00.000Z' },
            { version: 2, confirmedAt: '2024-04-04T09:00:00.000Z' },
          ],
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

    const autoLinkButton = await screen.findByRole('button', { name: '確定したスタートリストを連携' });
    expect(autoLinkButton).toBeEnabled();
    await user.click(autoLinkButton);

    await waitFor(() => {
      expect(attachStartlistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event-1',
          raceId: 'race-1',
          startlistId: 'SL-1',
          startlistLink: 'https://public.example.com/startlists/SL-1/v/3',
          startlistUpdatedAt: '2024-04-05T09:00:00.000Z',
          startlistPublicVersion: 3,
        }),
      );
    });

    expect(listEventsMock).toHaveBeenCalledTimes(2);
    expect(getEventMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to manual entry when no finalized startlist is available', async () => {
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
          snapshot: {
            id: 'SL-1',
            status: 'START_TIMES_ASSIGNED',
            laneAssignments: [],
            classAssignments: [],
            startTimes: [],
          },
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

    expect(screen.queryByRole('button', { name: '確定したスタートリストを連携' })).not.toBeInTheDocument();

    const startlistIdInput = screen.getByLabelText('スタートリストID');
    await user.clear(startlistIdInput);
    await user.type(startlistIdInput, 'SL-1');

    const urlInput = screen.getByLabelText('公開URL（任意）');
    await user.clear(urlInput);
    await user.type(urlInput, 'https://example.com/startlist');

    const submitButton = screen.getByRole('button', { name: 'スタートリストを設定' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(attachStartlistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event-1',
          raceId: 'race-1',
          startlistId: 'SL-1',
          startlistLink: 'https://example.com/startlist',
        }),
      );
    });

    expect(listEventsMock).toHaveBeenCalledTimes(2);
    expect(getEventMock).toHaveBeenCalledTimes(2);
  });

  it('auto selects the event and hides the attach form when already linked', async () => {
    env.VITE_STARTLIST_PUBLIC_BASE_URL = 'https://public.example.com';

    renderWithStartlistRouter(
      <StartlistLinkPage />,
      {
        routerProps: {
          initialEntries: ['/startlist/link'],
          initialIndex: 0,
        },
        initialState: {
          startlistId: 'SL-1',
          eventContext: { eventId: 'event-1', raceId: 'race-1' },
          eventLinkStatus: {
            status: 'success',
            eventId: 'event-1',
            raceId: 'race-1',
            startlistId: 'SL-1',
            startlistLink: 'https://public.example.com/startlists/SL-1/v/3',
            startlistUpdatedAt: '2024-04-05T09:00:00.000Z',
            startlistPublicVersion: 3,
          },
        },
      },
    );

    await waitFor(() => {
      expect(getEventMock).toHaveBeenCalledWith('event-1');
    });

    expect(
      await screen.findByText('イベント「春の大会」にスタートリストを自動連携しました。'),
    ).toBeInTheDocument();
    const eventDetailLinks = screen.getAllByRole('link', { name: 'イベント詳細を開く' });
    expect(eventDetailLinks.some((link) => link.getAttribute('href') === '/events/event-1')).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: 'スタートリストを設定' })).not.toBeInTheDocument();
    expect(screen.getByText('このイベントにはスタートリストが自動連携されています。')).toBeInTheDocument();
  });

  it('preselects the race when auto linking fails and allows manual retry', async () => {
    env.VITE_STARTLIST_PUBLIC_BASE_URL = 'https://public.example.com';
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
          eventContext: { eventId: 'event-1', raceId: 'race-1' },
          eventLinkStatus: {
            status: 'error',
            eventId: 'event-1',
            raceId: 'race-1',
            errorMessage: 'イベント連携に失敗しました。',
            startlistId: 'SL-1',
            startlistLink: 'https://public.example.com/startlists/SL-1/v/3',
            startlistUpdatedAt: '2024-04-05T09:00:00.000Z',
            startlistPublicVersion: 3,
          },
        },
      },
    );

    await waitFor(() => {
      expect(getEventMock).toHaveBeenCalledWith('event-1');
    });

    expect(await screen.findByText('イベント連携に失敗しました。')).toBeInTheDocument();
    const raceSelect = await screen.findByLabelText('対象レース');
    expect((raceSelect as HTMLSelectElement).value).toBe('race-1');

    const autoButton = await screen.findByRole('button', { name: '確定したスタートリストを連携' });
    await user.click(autoButton);

    await waitFor(() => {
      expect(attachStartlistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event-1',
          raceId: 'race-1',
          startlistId: 'SL-1',
          startlistLink: 'https://public.example.com/startlists/SL-1/v/3',
          startlistUpdatedAt: '2024-04-05T09:00:00.000Z',
          startlistPublicVersion: 3,
        }),
      );
    });
  });
});
