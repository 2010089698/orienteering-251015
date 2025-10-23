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
import type { StartlistWithHistoryDto } from '@startlist-management/application';
import { useEventManagementApi } from '../api/useEventManagementApi';
import { useStartlistApi } from '../../startlist/api/useStartlistApi';

vi.mock('../api/useEventManagementApi');
vi.mock('../../startlist/api/useStartlistApi');

const mockedUseEventManagementApi = vi.mocked(useEventManagementApi);
const mockedUseStartlistApi = vi.mocked(useStartlistApi);

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
        startlist: undefined,
      },
    ],
    ...overrides,
  }) as EventDto;

const createStartlistSnapshot = (
  overrides: Partial<StartlistWithHistoryDto> = {},
): StartlistWithHistoryDto => ({
  id: 'SL-1',
  status: 'FINALIZED',
  settings: undefined,
  laneAssignments: [],
  classAssignments: [],
  startTimes: [],
  versions: [],
  ...overrides,
});

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
    mockedUseStartlistApi.mockReset();
    const defaultSnapshot = createStartlistSnapshot();
    mockedUseStartlistApi.mockReturnValue({
      fetchSnapshot: vi.fn(async () => defaultSnapshot),
    } as unknown as ReturnType<typeof useStartlistApi>);
  });

  it('displays the event list, allows creating events, and navigates to the detail view', async () => {
    const events = [
      createEvent({ id: 'event-1', name: '春のミドル' }),
      createEvent({ id: 'event-2', name: '夏のロング' }),
    ];

    const createEventMock = vi.fn(async (command) => {
      return createEvent({ id: 'event-3', name: command.name });
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

    await user.type(screen.getByLabelText('イベント名'), '秋のスプリント');
    await user.type(screen.getByLabelText('開始日'), '2024-10-01');
    expect(screen.getByLabelText('終了日')).toHaveValue('2024-10-01');
    await user.type(screen.getByLabelText('会場'), '札幌');
    await user.click(screen.getByRole('button', { name: 'イベントを作成' }));

    await waitFor(() => {
      expect(createEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '秋のスプリント',
        }),
      );
    });

    const createPayload = createEventMock.mock.calls[0]?.[0];
    expect(createPayload).not.toHaveProperty('eventId');
    expect(createPayload?.startDate).toMatch(/Z$/);
    expect(createPayload?.endDate).toMatch(/Z$/);

    expect(screen.getByText('イベントを作成しました。')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '秋のスプリント' })).toBeInTheDocument();

    // Trigger a failure to ensure the error banner is shown.
    createEventMock.mockRejectedValueOnce(new Error('作成エラー'));

    await user.type(screen.getByLabelText('イベント名'), '冬のスプリント');
    await user.type(screen.getByLabelText('開始日'), '2024-12-01');
    expect(screen.getByLabelText('終了日')).toHaveValue('2024-12-01');
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

  it('renders the event detail, shows races, and surfaces startlist metadata after scheduling', async () => {
    const initialEvent = createEvent({
      races: [
        {
          id: 'race-1',
          name: 'Day 1',
          schedule: { start: '2024-04-01T01:00:00.000Z', end: undefined },
          duplicateDay: false,
          overlapsExisting: false,
          startlist: { id: 'SL-1', status: 'DRAFT' },
        },
      ],
    });
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
          startlist: { id: 'SL-2', status: 'FINALIZED' },
        },
      ],
    };

    const fetchSnapshotMock = vi.fn(async ({ startlistId }: { startlistId: string }) =>
      createStartlistSnapshot({
        id: startlistId,
        status: startlistId === 'SL-2' ? 'FINALIZED' : 'DRAFT',
        versions: [
          {
            version: startlistId === 'SL-2' ? 5 : 1,
            confirmedAt: '2024-04-05T09:00:00.000Z',
          },
        ],
        startTimes: [
          { playerId: 'P-1', laneNumber: 1, startTime: '2024-04-05T09:00:00.000Z' },
        ],
      }),
    );
    mockedUseStartlistApi.mockReturnValue({
      fetchSnapshot: fetchSnapshotMock,
    } as unknown as ReturnType<typeof useStartlistApi>);

    const getEventMock = vi
      .fn<Parameters<EventManagementApiMock['getEvent']>, ReturnType<EventManagementApiMock['getEvent']>>()
      .mockResolvedValueOnce(initialEvent)
      .mockResolvedValueOnce(scheduledEvent)
      .mockResolvedValue(scheduledEvent);

    const scheduleRaceMock = vi.fn(async () => ({
      event: scheduledEvent,
      startlist: { raceId: 'race-2', raceName: 'Day 2', startlistId: 'SL-2', status: 'FINALIZED' },
    }));

    const apiMock = createEventManagementApiMock({
      listEvents: vi.fn(async () => []),
      getEvent: getEventMock,
      scheduleRace: scheduleRaceMock,
    });

    mockedUseEventManagementApi.mockReturnValue(apiMock);

    const user = userEvent.setup();

    renderLayout(['/events/event-1']);

    expect(await screen.findByRole('heading', { name: '春のミドル' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(await screen.findByText('ID: SL-1')).toBeInTheDocument();
    expect(fetchSnapshotMock).toHaveBeenCalledWith({ startlistId: 'SL-1', includeVersions: true, versionLimit: 1 });

    await user.type(screen.getByLabelText('レース名'), 'Day 2');
    await user.type(screen.getByLabelText('レース日'), '2024-04-02');
    await user.click(screen.getByRole('button', { name: 'レースを登録' }));

    expect(
      await screen.findByText('レースをスケジュールしました。スタートリスト SL-2（公開済み） を自動作成しました。'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('rowheader', { name: 'Day 2' })).toBeInTheDocument();
    expect(fetchSnapshotMock).toHaveBeenCalledWith({ startlistId: 'SL-2', includeVersions: true, versionLimit: 1 });
    const schedulePayload = scheduleRaceMock.mock.calls.at(-1)?.[0];
    expect(schedulePayload).toMatchObject({ eventId: 'event-1', name: 'Day 2', date: '2024-04-02' });

    const managementLinks = await screen.findAllByRole('link', { name: 'スタートリストを編集' });
    const hrefs = managementLinks.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/startlist?eventId=event-1');
    expect(hrefs).toContain('/startlist?eventId=event-1&raceId=race-1');
    expect(hrefs).toContain('/startlist?eventId=event-1&raceId=race-2');
  });
});
