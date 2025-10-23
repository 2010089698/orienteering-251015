import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import StartTimesPanel from './StartTimesPanel';
import { renderWithStartlist } from '../test/test-utils';
import type { Entry } from '../state/types';
import type { ClassAssignmentDto, StartTimeDto } from '@startlist-management/application';

const assignStartTimesMock = vi.fn();
const finalizeMock = vi.fn();
const invalidateStartTimesMock = vi.fn();
const fetchVersionsMock = vi.fn();
const fetchDiffMock = vi.fn();
const tryAutoAttachStartlistMock = vi.fn();

vi.mock('../api/useStartlistApi', () => ({
  useStartlistApi: () => ({
    assignStartTimes: assignStartTimesMock,
    finalize: finalizeMock,
    invalidateStartTimes: invalidateStartTimesMock,
    fetchVersions: fetchVersionsMock,
    fetchDiff: fetchDiffMock,
  }),
}));

vi.mock('../utils/eventLinking', () => ({
  tryAutoAttachStartlist: (...args: unknown[]) => {
    tryAutoAttachStartlistMock(...args);
    return Promise.resolve('success');
  },
}));

const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;
let previousPublicBaseUrl: string | undefined;

const entries: Entry[] = [
  {
    id: 'player-1',
    name: '田中 太郎',
    classId: 'SP',
    club: 'Tokyo OC',
    cardNo: '123456',
  },
];

const startTimes: StartTimeDto[] = [
  {
    playerId: 'player-1',
    laneNumber: 1,
    startTime: '2024-04-01T09:00:00.000Z',
  },
];

const settings = {
  eventId: 'event',
  startTime: '2024-04-01T00:00:00.000Z',
  intervals: {
    laneClass: { milliseconds: 60000 },
    classPlayer: { milliseconds: 45000 },
  },
  laneCount: 2,
};

const classAssignments: ClassAssignmentDto[] = [
  {
    classId: 'SP1',
    playerOrder: ['player-1'],
    interval: { milliseconds: 60000 },
  },
];

const flushAsync = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('StartTimesPanel', () => {
  let originalBlob: typeof Blob;

  beforeEach(() => {
    previousPublicBaseUrl = env.VITE_STARTLIST_PUBLIC_BASE_URL;
    env.VITE_STARTLIST_PUBLIC_BASE_URL = undefined;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-04-01T00:00:00.000Z'));
    originalBlob = Blob;
    assignStartTimesMock.mockResolvedValue(undefined);
    finalizeMock.mockResolvedValue(undefined);
    invalidateStartTimesMock.mockResolvedValue(undefined);
    fetchVersionsMock.mockImplementation(async (query: { startlistId: string; limit?: number; offset?: number }) => ({
      startlistId: query.startlistId,
      total: 0,
      items: [],
    }));
    fetchDiffMock.mockImplementation(async (query: { startlistId: string; toVersion?: number; fromVersion?: number }) => ({
      startlistId: query.startlistId,
      to: { version: query.toVersion ?? 0, confirmedAt: '2024-04-01T00:00:00.000Z' },
      ...(query.fromVersion
        ? { from: { version: query.fromVersion, confirmedAt: '2024-03-31T00:00:00.000Z' } }
        : {}),
      changes: {},
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: originalBlob,
    });
    assignStartTimesMock.mockReset();
    finalizeMock.mockReset();
    invalidateStartTimesMock.mockReset();
    fetchVersionsMock.mockReset();
    fetchDiffMock.mockReset();
    tryAutoAttachStartlistMock.mockReset();
    env.VITE_STARTLIST_PUBLIC_BASE_URL = previousPublicBaseUrl;
    vi.restoreAllMocks();
  });

  it('exports CSV when the export button is clicked', async () => {
    let capturedBlob: Blob | null = null;
    const createObjectURLMock = vi.fn((value: Blob) => {
      capturedBlob = value;
      return 'blob:mock';
    });
    const revokeObjectURLMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock as unknown as typeof URL.createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock as unknown as typeof URL.revokeObjectURL,
    });
    const capturedParts: BlobPart[][] = [];
    class CapturingBlob extends originalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        capturedParts.push(parts);
      }
    }
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: CapturingBlob as unknown as typeof Blob,
    });
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderWithStartlist(<StartTimesPanel />, {
      initialState: {
        entries,
        startTimes,
        classAssignments,
        statuses: {
          startTimes: { level: 'idle', text: '' },
        },
      },
    });

    await flushAsync();

    const button = screen.getByRole('button', { name: 'CSV をエクスポート' });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);

    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob).toBeInstanceOf(originalBlob);
    const [parts] = capturedParts;
    expect(parts).toBeDefined();
    const csvString = parts.map((part) => (typeof part === 'string' ? part : String(part))).join('');
    expect(csvString).toBe(
      '\ufeffクラス,スタート番号,氏名,所属,スタート時刻,カード番号\r\nSP1,1001,田中 太郎,Tokyo OC,18:00,123456',
    );

    expect(clickMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock');
    expect(screen.getByText('1 件のスタート時間をエクスポートしました。')).toBeInTheDocument();
  });

  it('highlights diff status for added, updated, and removed start times', async () => {
    vi.useRealTimers();
    const versionsResponse = {
      total: 2,
      items: [
        {
          version: 2,
          confirmedAt: '2024-04-02T00:00:00.000Z',
          snapshot: {
            id: 'SL-1',
            status: 'START_TIMES_ASSIGNED',
            settings: undefined,
            laneAssignments: [],
            classAssignments: [],
            startTimes: [],
          },
        },
        {
          version: 1,
          confirmedAt: '2024-04-01T00:00:00.000Z',
          snapshot: {
            id: 'SL-1',
            status: 'START_TIMES_ASSIGNED',
            settings: undefined,
            laneAssignments: [],
            classAssignments: [],
            startTimes: [],
          },
        },
      ],
    };
    const diffResponse = {
      to: { version: 2, confirmedAt: '2024-04-02T00:00:00.000Z' },
      from: { version: 1, confirmedAt: '2024-04-01T00:00:00.000Z' },
      changes: {
        startTimes: {
          previous: [
            { playerId: 'player-1', laneNumber: 1, startTime: '2024-04-01T09:00:00.000Z' },
            { playerId: 'player-3', laneNumber: 3, startTime: '2024-04-01T09:04:00.000Z' },
          ],
          current: [
            { playerId: 'player-1', laneNumber: 1, startTime: '2024-04-01T09:05:00.000Z' },
            { playerId: 'player-2', laneNumber: 2, startTime: '2024-04-01T09:02:00.000Z' },
          ],
        },
      },
    };

    fetchVersionsMock.mockImplementation(async (query: { startlistId: string; limit?: number; offset?: number }) => ({
      startlistId: query.startlistId,
      ...versionsResponse,
    }));
    fetchDiffMock.mockImplementation(async (query: { startlistId: string; toVersion?: number; fromVersion?: number }) => ({
      startlistId: query.startlistId,
      to: {
        ...diffResponse.to,
        version: query.toVersion ?? diffResponse.to.version,
      },
      ...(query.fromVersion
        ? {
            from: {
              ...diffResponse.from,
              version: query.fromVersion,
            },
          }
        : { from: diffResponse.from }),
      changes: {
        ...diffResponse.changes,
        startTimes: {
          previous: diffResponse.changes.startTimes.previous.map((item) => ({ ...item })),
          current: diffResponse.changes.startTimes.current.map((item) => ({ ...item })),
        },
      },
    }));

    renderWithStartlist(<StartTimesPanel />, {
      initialState: {
        startlistId: 'SL-1',
        settings,
        startTimes: [
          { playerId: 'player-1', laneNumber: 1, startTime: '2024-04-01T09:05:00.000Z' },
          { playerId: 'player-2', laneNumber: 2, startTime: '2024-04-01T09:02:00.000Z' },
        ],
        classAssignments,
        statuses: {
          startTimes: { level: 'idle', text: '' },
        },
      },
    });

    await waitFor(() => expect(fetchVersionsMock).toHaveBeenCalled());
    await waitFor(() => expect(fetchDiffMock).toHaveBeenCalled());

    expect(fetchVersionsMock).toHaveBeenCalledWith(expect.objectContaining({ startlistId: 'SL-1', limit: 2 }));
    expect(fetchDiffMock).toHaveBeenCalledWith(
      expect.objectContaining({ startlistId: 'SL-1', fromVersion: 1, toVersion: 2 }),
    );


    await screen.findByText(/比較対象: 最新 v2/);

    const updatedRow = (await screen.findByText('player-1', { exact: false })).closest('tr');
    const addedRow = (await screen.findByText('player-2', { exact: false })).closest('tr');
    const removedRow = (await screen.findByText('player-3', { exact: false })).closest('tr');

    if (!updatedRow || !addedRow || !removedRow) {
      throw new Error('差分の行が見つかりませんでした。');
    }

    expect(updatedRow).toHaveClass('diff-updated');
    expect(addedRow).toHaveClass('diff-added');
    expect(removedRow).toHaveClass('diff-removed');

    expect(await within(updatedRow).findByText('更新')).toBeInTheDocument();
    expect(await within(addedRow).findByText('追加')).toBeInTheDocument();
    expect(await within(removedRow).findByText('削除')).toBeInTheDocument();
    expect(screen.getByText(/比較対象: 最新 v2/)).toHaveTextContent('前回 v1');
    await waitFor(() => expect(screen.getAllByText('追加')).toHaveLength(2)); // legend + annotation
  });

  it('re-fetches diff after persisting start times', async () => {
    vi.useRealTimers();
    const versionsResponse = {
      total: 2,
      items: [
        {
          version: 2,
          confirmedAt: '2024-04-02T00:00:00.000Z',
          snapshot: {
            id: 'SL-1',
            status: 'START_TIMES_ASSIGNED',
            settings: undefined,
            laneAssignments: [],
            classAssignments: [],
            startTimes: [],
          },
        },
        {
          version: 1,
          confirmedAt: '2024-04-01T00:00:00.000Z',
          snapshot: {
            id: 'SL-1',
            status: 'START_TIMES_ASSIGNED',
            settings: undefined,
            laneAssignments: [],
            classAssignments: [],
            startTimes: [],
          },
        },
      ],
    };
    const diffResponse = {
      to: { version: 2, confirmedAt: '2024-04-02T00:00:00.000Z' },
      from: { version: 1, confirmedAt: '2024-04-01T00:00:00.000Z' },
      changes: { startTimes: { previous: [], current: [] } },
    };

    fetchVersionsMock.mockImplementation(async (query: { startlistId: string; limit?: number; offset?: number }) => ({
      startlistId: query.startlistId,
      ...versionsResponse,
    }));
    fetchDiffMock.mockImplementation(async (query: { startlistId: string; toVersion?: number; fromVersion?: number }) => ({
      startlistId: query.startlistId,
      to: {
        ...diffResponse.to,
        version: query.toVersion ?? diffResponse.to.version,
      },
      ...(query.fromVersion
        ? {
            from: {
              ...diffResponse.from,
              version: query.fromVersion,
            },
          }
        : { from: diffResponse.from }),
      changes: diffResponse.changes,
    }));

    const snapshot = {
      id: 'SL-1',
      status: 'START_TIMES_ASSIGNED',
      laneAssignments: [],
      classAssignments: [],
      startTimes: [],
    };
    assignStartTimesMock.mockResolvedValue(snapshot);

    renderWithStartlist(<StartTimesPanel />, {
      initialState: {
        startlistId: 'SL-1',
        settings,
        startTimes,
        classAssignments,
        statuses: {
          startTimes: { level: 'idle', text: '' },
        },
      },
    });

    await waitFor(() => expect(fetchVersionsMock).toHaveBeenCalled());
    await waitFor(() => expect(fetchDiffMock).toHaveBeenCalled());

    expect(fetchVersionsMock).toHaveBeenCalledWith(expect.objectContaining({ startlistId: 'SL-1', limit: 2 }));
    expect(fetchDiffMock).toHaveBeenCalledWith(
      expect.objectContaining({ startlistId: 'SL-1', fromVersion: 1, toVersion: 2 }),
    );

    fetchVersionsMock.mockClear();
    fetchDiffMock.mockClear();

    const persistButton = screen.getByRole('button', { name: 'API に送信' });
    fireEvent.click(persistButton);

    await waitFor(() => expect(assignStartTimesMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchVersionsMock.mock.calls.length).toBeGreaterThan(0));
    await waitFor(() => expect(fetchDiffMock.mock.calls.length).toBeGreaterThan(0));
  });

  it('auto-attaches finalized startlists when event context is provided', async () => {
    const versionsResponse = {
      startlistId: 'SL-1',
      total: 1,
      items: [
        {
          version: 3,
          confirmedAt: '2024-04-05T09:00:00.000Z',
          snapshot: {
            id: 'SL-1',
            status: 'FINALIZED',
            settings: undefined,
            laneAssignments: [],
            classAssignments: [],
            startTimes: [],
          },
        },
      ],
    };

    fetchVersionsMock.mockImplementation(async (query: { startlistId: string; limit?: number; offset?: number }) => {
      if (query.limit === 1) {
        return versionsResponse;
      }
      return versionsResponse;
    });

    finalizeMock.mockResolvedValue({
      id: 'SL-1',
      status: 'FINALIZED',
      laneAssignments: [],
      classAssignments: [],
      startTimes: [],
    });

    renderWithStartlist(<StartTimesPanel />, {
      initialState: {
        startlistId: 'SL-1',
        settings,
        startTimes,
        classAssignments,
        statuses: {
          startTimes: { level: 'idle', text: '' },
        },
        eventContext: { eventId: 'event-1', raceId: 'race-1' },
      },
    });

    const finalizeButton = screen.getByRole('button', { name: 'スタートリストを確定' });
    fireEvent.click(finalizeButton);

    await waitFor(() => expect(finalizeMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(tryAutoAttachStartlistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventContext: { eventId: 'event-1', raceId: 'race-1' },
          startlistId: 'SL-1',
          version: 3,
          confirmedAt: '2024-04-05T09:00:00.000Z',
          startlistStatus: 'FINALIZED',
          attachStartlist: expect.any(Function),
        }),
      );
    });
    const [firstCall] = fetchVersionsMock.mock.calls;
    expect(firstCall[0]).toEqual({ startlistId: 'SL-1', limit: 1 });
  });
});
