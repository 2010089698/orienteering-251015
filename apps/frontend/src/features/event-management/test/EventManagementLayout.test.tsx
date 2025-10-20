import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';

import EventManagementLayout from '../EventManagementLayout';
import {
  type EventManagementApiMock,
  createEventManagementApiMock,
  renderWithEventManagementRouter,
} from './test-utils';
import type { EventDto } from '@event-management/application';
import { useEventManagementApi } from '../api/useEventManagementApi';

vi.mock('../api/useEventManagementApi');

const mockedUseEventManagementApi = vi.mocked(useEventManagementApi);

const createEvent = (overrides: Partial<EventDto> = {}): EventDto =>
  ({
    id: 'event-1',
    name: '春のミドル',
    startDate: '2024-04-01T00:00:00.000Z',
    endDate: '2024-04-02T00:00:00.000Z',
    venue: '東京',
    allowMultipleRacesPerDay: true,
    allowScheduleOverlap: true,
    races: [
      {
        id: 'race-1',
        name: 'Day 1',
        schedule: { start: '2024-04-01T01:00:00.000Z', end: undefined },
        duplicateDay: false,
        overlapsExisting: false,
        startlistLink: undefined,
      },
    ],
    ...overrides,
  }) as EventDto;

const renderLayout = (initialEntries: string[]) => {
  return renderWithEventManagementRouter(
    <Routes>
      <Route path="/events/*" element={<EventManagementLayout />} />
    </Routes>,
    { router: { initialEntries } },
  );
};

describe('EventManagementLayout', () => {
  beforeEach(() => {
    mockedUseEventManagementApi.mockReset();
  });

  it('displays the event list, allows creating events, and navigates to the detail view', async () => {
    const events = [
      createEvent({ id: 'event-1', name: '春のミドル' }),
      createEvent({ id: 'event-2', name: '夏のロング' }),
    ];

    const createEventMock = vi.fn(async (command) => {
      return createEvent({ id: command.eventId, name: command.name });
    });

    const apiMock = createEventManagementApiMock({
      listEvents: vi.fn(async () => events),
      createEvent: createEventMock,
      getEvent: vi.fn(async (eventId: string) => {
        return events.find((event) => event.id === eventId) ?? createEvent({ id: eventId });
      }),
    });

    mockedUseEventManagementApi.mockReturnValue(apiMock);

    const user = userEvent.setup();

    renderLayout(['/events']);

    expect(await screen.findByRole('heading', { name: 'イベント管理' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '春のミドル' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '夏のロング' })).toBeInTheDocument();
    expect(apiMock.listEvents).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText('イベントID'), 'event-3');
    await user.type(screen.getByLabelText('イベント名'), '秋のスプリント');
    await user.type(screen.getByLabelText('開始日'), '2024-10-01');
    await user.type(screen.getByLabelText('終了日'), '2024-10-01');
    await user.type(screen.getByLabelText('会場'), '札幌');
    await user.click(screen.getByRole('button', { name: 'イベントを作成' }));

    await waitFor(() => {
      expect(createEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event-3',
          name: '秋のスプリント',
        }),
      );
    });

    const createPayload = createEventMock.mock.calls[0]?.[0];
    expect(createPayload?.startDate).toMatch(/Z$/);
    expect(createPayload?.endDate).toMatch(/Z$/);

    expect(screen.getByText('イベントを作成しました。')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '秋のスプリント' })).toBeInTheDocument();

    // Trigger a failure to ensure the error banner is shown.
    createEventMock.mockRejectedValueOnce(new Error('作成エラー'));

    await user.type(screen.getByLabelText('イベントID'), 'event-4');
    await user.type(screen.getByLabelText('イベント名'), '冬のスプリント');
    await user.type(screen.getByLabelText('開始日'), '2024-12-01');
    await user.type(screen.getByLabelText('終了日'), '2024-12-01');
    await user.type(screen.getByLabelText('会場'), '札幌');
    await user.click(screen.getByRole('button', { name: 'イベントを作成' }));

    const errorMessages = await screen.findAllByText('作成エラー');
    expect(errorMessages.length).toBeGreaterThan(0);

    await user.click(screen.getByRole('link', { name: '春のミドル' }));

    expect(await screen.findByRole('heading', { name: '春のミドル' })).toBeInTheDocument();
  });

  it('handles missing events by showing a not-found message in the detail view', async () => {
    const apiMock = createEventManagementApiMock({
      listEvents: vi.fn(async () => []),
      getEvent: vi.fn(async () => {
        throw new Error('404 Not Found');
      }),
    });

    mockedUseEventManagementApi.mockReturnValue(apiMock);

    renderLayout(['/events/missing-event']);

    expect(await screen.findByText('指定されたイベントが見つかりません。')).toBeInTheDocument();
  });

  it('renders the event detail, shows races, and updates after scheduling and attaching startlists', async () => {
    const initialEvent = createEvent();
    const scheduledEvent: EventDto = {
      ...initialEvent,
      races: [
        ...initialEvent.races,
        {
          id: 'race-2',
          name: 'Day 2',
          schedule: { start: '2024-04-02T01:00:00.000Z', end: undefined },
          duplicateDay: false,
          overlapsExisting: false,
          startlistLink: undefined,
        },
      ],
    };
    const attachedEvent: EventDto = {
      ...scheduledEvent,
      races: scheduledEvent.races.map((race) =>
        race.id === 'race-1' ? { ...race, startlistLink: 'https://example.com/startlist' } : race,
      ),
    };

    const getEventMock = vi
      .fn<Parameters<EventManagementApiMock['getEvent']>, ReturnType<EventManagementApiMock['getEvent']>>()
      .mockResolvedValueOnce(initialEvent)
      .mockResolvedValueOnce(scheduledEvent)
      .mockResolvedValueOnce(attachedEvent)
      .mockResolvedValue(attachedEvent);

    const scheduleRaceMock = vi.fn(async () => scheduledEvent);
    const attachStartlistMock = vi.fn(async () => attachedEvent);

    const apiMock = createEventManagementApiMock({
      listEvents: vi.fn(async () => []),
      getEvent: getEventMock,
      scheduleRace: scheduleRaceMock,
      attachStartlist: attachStartlistMock,
    });

    mockedUseEventManagementApi.mockReturnValue(apiMock);

    const user = userEvent.setup();

    renderLayout(['/events/event-1']);

    expect(await screen.findByRole('heading', { name: '春のミドル' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('レースがまだスケジュールされていません。')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('レースID'), 'race-2');
    await user.type(screen.getByLabelText('レース名'), 'Day 2');
    await user.type(screen.getByLabelText('開始日時'), '2024-04-02T10:00');
    await user.click(screen.getByRole('button', { name: 'レースを登録' }));

    expect(await screen.findByText('レースをスケジュールしました。')).toBeInTheDocument();
    expect(await screen.findByRole('rowheader', { name: 'Day 2' })).toBeInTheDocument();
    const schedulePayload = scheduleRaceMock.mock.calls.at(-1)?.[0];
    expect(schedulePayload).toMatchObject({ eventId: 'event-1', raceId: 'race-2' });
    expect(schedulePayload?.start).toMatch(/Z$/);

    await user.selectOptions(screen.getByLabelText('対象レース'), 'race-1');
    await user.type(screen.getByLabelText('スタートリストURL'), 'https://example.com/startlist');
    await user.click(screen.getByRole('button', { name: 'スタートリストを設定' }));

    expect(await screen.findByText('スタートリストを連携しました。')).toBeInTheDocument();
    const startlistLink = await screen.findByRole('link', { name: 'スタートリストを表示' });
    expect(startlistLink).toHaveAttribute('href', 'https://example.com/startlist');
    const attachPayload = attachStartlistMock.mock.calls.at(-1)?.[0];
    expect(attachPayload).toMatchObject({ eventId: 'event-1', raceId: 'race-1', startlistLink: 'https://example.com/startlist' });
  });
});
