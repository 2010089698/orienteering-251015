import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useInputStepController } from '../hooks/useInputStepController';
import { useLaneAssignmentController } from '../hooks/useLaneAssignmentController';
import { useClassOrderController } from '../hooks/useClassOrderController';

const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSetStatus: vi.fn(),
  mockUpdateLaneAssignments: vi.fn(),
  mockUpdateClassAssignments: vi.fn(),
  mockUpdateStartTimes: vi.fn(),
  mockSetLoading: vi.fn(),
  mockSubmitSettings: vi.fn(),
  mockGenerateLaneAssignments: vi.fn(),
  mockCreateDefaultClassAssignments: vi.fn(),
  mockCalculateStartTimes: vi.fn(),
  mockReorderLaneClass: vi.fn(),
  mockUpdateClassPlayerOrder: vi.fn(),
  mockDeriveClassOrderWarnings: vi.fn(),
  mockDownloadStartlistCsv: vi.fn(),
  mockDispatch: vi.fn(),
  mockEnterSettings: vi.fn(),
  mockAssignLaneOrder: vi.fn(),
  mockAssignPlayerOrder: vi.fn(),
  mockAssignStartTimes: vi.fn(),
  mockFinalize: vi.fn(),
  mockFetchVersions: vi.fn(),
  mockUpdateSnapshot: vi.fn(),
  mockAttachStartlist: vi.fn(),
  mockSetEventLinkStatus: vi.fn(),
}));

const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;
let previousPublicBaseUrl: string | undefined;

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.mockNavigate,
}));

vi.mock('../../state/StartlistContext', () => ({
  useStartlistEntries: () => mockEntries,
  useStartlistStatuses: () => mockStatuses,
  useStartlistClassSplitRules: () => mockClassSplitRules,
  useStartlistClassSplitResult: () => mockClassSplitResult,
  useStartlistDispatch: () => mocks.mockDispatch,
  useStartlistLaneAssignments: () => mockLaneAssignments,
  useStartlistSettings: () => mockSettings,
  useStartlistStartlistId: () => mockStartlistId,
  useStartlistEventContext: () => mockEventContext,
  useStartlistClassAssignments: () => mockClassAssignments,
  useStartlistClassOrderSeed: () => mockClassOrderSeed,
  useStartlistClassOrderPreferences: () => mockClassOrderPreferences,
  useStartlistStartOrderRules: () => mockStartOrderRules,
  useStartlistWorldRankingByClass: () => mockWorldRankingByClass,
  useStartlistStartTimes: () => mockStartTimes,
  useStartlistClassOrderWarnings: () => mockClassOrderWarnings,
  useStartlistLoading: () => mockLoading,
  createStatus: (text: string, level: string) => ({ text, level }),
  setStatus: mocks.mockSetStatus,
  updateLaneAssignments: mocks.mockUpdateLaneAssignments,
  updateClassAssignments: mocks.mockUpdateClassAssignments,
  updateStartTimes: mocks.mockUpdateStartTimes,
  updateSnapshot: mocks.mockUpdateSnapshot,
  setLoading: mocks.mockSetLoading,
  setEventLinkStatus: mocks.mockSetEventLinkStatus,
}));

vi.mock('../../hooks/useSettingsForm', () => ({
  useSettingsForm: () => ({
    fields: {
      eventId: 'event-1',
      startTime: '2024-01-01T09:00',
      laneIntervalMs: 60000,
      playerIntervalMs: 45000,
      laneCount: 2,
      avoidConsecutiveClubs: false,
    },
    errors: { form: null },
    laneIntervalOptions: [],
    playerIntervalOptions: [],
    status: { text: '', level: 'info' },
    onChange: {
      eventId: vi.fn(),
      startTime: vi.fn(),
      laneIntervalMs: vi.fn(),
      playerIntervalMs: vi.fn(),
      laneCount: vi.fn(),
      avoidConsecutiveClubs: vi.fn(),
    },
    submit: mocks.mockSubmitSettings,
  }),
}));

vi.mock('../../utils/startlistUtils', async () => {
  const actual = await vi.importActual<typeof import('../../utils/startlistUtils')>(
    '../../utils/startlistUtils',
  );
  return {
    ...actual,
    generateLaneAssignments: mocks.mockGenerateLaneAssignments,
    createDefaultClassAssignments: mocks.mockCreateDefaultClassAssignments,
    calculateStartTimes: mocks.mockCalculateStartTimes,
    reorderLaneClass: mocks.mockReorderLaneClass,
    updateClassPlayerOrder: mocks.mockUpdateClassPlayerOrder,
    deriveClassOrderWarnings: mocks.mockDeriveClassOrderWarnings,
  };
});

vi.mock('../../utils/startlistExport', () => ({
  downloadStartlistCsv: (...args: any[]) => mocks.mockDownloadStartlistCsv(...args),
}));

vi.mock('../../api/useStartlistApi', () => ({
  useStartlistApi: () => ({
    enterSettings: mocks.mockEnterSettings,
    assignLaneOrder: mocks.mockAssignLaneOrder,
    assignPlayerOrder: mocks.mockAssignPlayerOrder,
    assignStartTimes: mocks.mockAssignStartTimes,
    finalize: mocks.mockFinalize,
    fetchVersions: mocks.mockFetchVersions,
  }),
}));

vi.mock('../../../event-management/api/useEventManagementApi', () => ({
  useEventManagementApi: () => ({
    attachStartlist: mocks.mockAttachStartlist,
  }),
}));

let mockEntries: any[] = [];
let mockLaneAssignments: any[] = [];
let mockSettings: any = undefined;
let mockStatuses: any = {};
let mockClassAssignments: any[] = [];
let mockClassOrderSeed: string | undefined;
let mockClassOrderPreferences: any = { avoidConsecutiveClubs: false };
let mockStartOrderRules: any[] = [];
let mockWorldRankingByClass: any = new Map();
let mockClassSplitRules: any[] = [];
let mockClassSplitResult: any = undefined;
let mockStartlistId = 'startlist-1';
let mockStartTimes: any[] = [];
let mockClassOrderWarnings: any[] = [];
let mockLoading: any = { startTimes: false };
let mockEventContext: any = {};
const mockSnapshot: any = { id: 'snapshot-1' };

const resetState = () => {
  mockEntries = [
    { id: '1', classId: 'M21', name: 'Alice' },
    { id: '2', classId: 'W21', name: 'Bob' },
  ];
  mockLaneAssignments = [
    { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
    { laneNumber: 2, classOrder: ['W21'], interval: { milliseconds: 60000 } },
  ];
  mockSettings = {
    eventId: 'event-1',
    startTime: '2024-01-01T09:00:00Z',
    laneCount: 2,
    intervals: {
      laneClass: { milliseconds: 60000 },
      classPlayer: { milliseconds: 45000 },
    },
  };
  mockStatuses = {
    lanes: { text: '', level: 'info' },
    classes: { text: '', level: 'info' },
    startTimes: { text: '', level: 'info' },
    snapshot: { text: '', level: 'info' },
  };
  mockClassAssignments = [];
  mockClassOrderSeed = 'seed-1';
  mockClassOrderPreferences = { avoidConsecutiveClubs: false };
  mockStartOrderRules = [];
  mockWorldRankingByClass = new Map();
  mockClassSplitRules = [];
  mockClassSplitResult = undefined;
  mockStartlistId = 'startlist-1';
  mockStartTimes = [];
  mockClassOrderWarnings = [];
  mockLoading = { startTimes: false };
  mocks.mockSubmitSettings.mockReturnValue({
    settings: {
      eventId: 'event-1',
      intervals: { laneClass: { milliseconds: 60000 } },
      laneCount: 2,
    },
  });
  mocks.mockGenerateLaneAssignments.mockReset();
  mocks.mockGenerateLaneAssignments.mockReturnValue({
    assignments: [
      { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
    ],
    splitResult: undefined,
  });
  mocks.mockCreateDefaultClassAssignments.mockReset();
  mocks.mockCreateDefaultClassAssignments.mockReturnValue({
    assignments: [{ classId: 'M21', playerOrder: ['1'] }],
    seed: 'seed-1',
    warnings: [],
    splitResult: undefined,
  });
  mocks.mockCalculateStartTimes.mockReset();
  mocks.mockCalculateStartTimes.mockReturnValue([{ playerId: '1', startTime: '2024-01-01T09:00:00Z' }]);
  mocks.mockReorderLaneClass.mockImplementation((lanes) => lanes);
  mocks.mockUpdateClassPlayerOrder.mockImplementation((assignments) => assignments);
  mocks.mockDeriveClassOrderWarnings.mockReturnValue([]);
  mocks.mockDownloadStartlistCsv.mockReturnValue(10);
  mocks.mockSetStatus.mockReset();
  mocks.mockUpdateLaneAssignments.mockReset();
  mocks.mockUpdateClassAssignments.mockReset();
  mocks.mockUpdateStartTimes.mockReset();
  mocks.mockSetLoading.mockReset();
  mocks.mockDispatch.mockReset();
  mocks.mockNavigate.mockReset();
  mocks.mockEnterSettings.mockReset();
  mocks.mockEnterSettings.mockResolvedValue(mockSnapshot);
  mocks.mockAssignLaneOrder.mockReset();
  mocks.mockAssignLaneOrder.mockResolvedValue(mockSnapshot);
  mocks.mockAssignPlayerOrder.mockReset();
  mocks.mockAssignPlayerOrder.mockResolvedValue(undefined);
  mocks.mockAssignStartTimes.mockReset();
  mocks.mockAssignStartTimes.mockResolvedValue(undefined);
  mocks.mockFinalize.mockReset();
  mocks.mockFinalize.mockResolvedValue(undefined);
  mocks.mockFetchVersions.mockReset();
  mocks.mockFetchVersions.mockResolvedValue({
    startlistId: mockStartlistId,
    total: 1,
    items: [
      {
        version: 3,
        confirmedAt: '2024-04-05T09:00:00.000Z',
        snapshot: {
          id: mockStartlistId,
          status: 'FINALIZED',
          settings: undefined,
          laneAssignments: [],
          classAssignments: [],
          startTimes: [],
        },
      },
    ],
  });
  mocks.mockUpdateSnapshot.mockReset();
  mocks.mockAttachStartlist.mockReset();
  mocks.mockAttachStartlist.mockResolvedValue(undefined);
  mocks.mockSetEventLinkStatus.mockReset();
  mockEventContext = { eventId: 'event-1', raceId: 'race-1' };
};

beforeEach(() => {
  previousPublicBaseUrl = env.VITE_STARTLIST_PUBLIC_BASE_URL;
  env.VITE_STARTLIST_PUBLIC_BASE_URL = 'https://public.example.com';
  resetState();
});

afterEach(() => {
  env.VITE_STARTLIST_PUBLIC_BASE_URL = previousPublicBaseUrl;
});

describe('useInputStepController', () => {
  it('falls back to the all tab when entries change', async () => {
    const { result, rerender } = renderHook(() => useInputStepController());
    expect(result.current.activeTab).toBe('all');

    act(() => {
      result.current.onTabChange('M21');
    });
    expect(result.current.activeTab).toBe('M21');

    mockEntries = [];
    rerender();

    await waitFor(() => {
      expect(result.current.activeTab).toBe('all');
    });
  });

  it('validates and navigates to the lane step on completion', async () => {
    const { result } = renderHook(() => useInputStepController());

    await act(async () => {
      await result.current.onComplete();
    });

    expect(mocks.mockEnterSettings).toHaveBeenCalledWith({
      startlistId: mockStartlistId,
      settings: expect.objectContaining({
        laneCount: 2,
        intervals: expect.objectContaining({
          laneClass: expect.objectContaining({ milliseconds: 60000 }),
        }),
      }),
    });
    expect(mocks.mockUpdateSnapshot).toHaveBeenCalledWith(mocks.mockDispatch, mockSnapshot);

    expect(mocks.mockGenerateLaneAssignments).toHaveBeenCalledWith(
      expect.any(Array),
      2,
      60000,
      expect.objectContaining({
        splitRules: mockClassSplitRules,
        previousSplitResult: mockClassSplitResult,
        startOrderRules: mockStartOrderRules,
        worldRankingByClass: mockWorldRankingByClass,
      }),
    );
    expect(mocks.mockUpdateLaneAssignments).toHaveBeenCalled();
    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'lanes',
      expect.objectContaining({ level: 'success' }),
    );
    expect(mocks.mockNavigate).toHaveBeenCalledWith('/startlist/lanes');
  });

  it('displays an error when saving settings fails', async () => {
    const error = new Error('設定の保存に失敗しました。');
    mocks.mockEnterSettings.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useInputStepController());

    await act(async () => {
      await result.current.onComplete();
    });

    expect(mocks.mockEnterSettings).toHaveBeenCalled();
    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'settings',
      expect.objectContaining({ level: 'error', text: error.message }),
    );
    expect(mocks.mockUpdateSnapshot).not.toHaveBeenCalled();
    expect(mocks.mockUpdateLaneAssignments).not.toHaveBeenCalled();
    expect(mocks.mockNavigate).not.toHaveBeenCalled();
  });
});

describe('useLaneAssignmentController', () => {
  it('keeps the active tab in sync with available lanes', async () => {
    const { result, rerender } = renderHook(() => useLaneAssignmentController());

    act(() => {
      result.current.onTabChange('lane-2');
    });
    expect(result.current.activeTab).toBe('lane-2');

    mockLaneAssignments = [mockLaneAssignments[0]];
    mockSettings = {
      ...mockSettings,
      laneCount: 1,
    };
    rerender();

    await waitFor(() => {
      expect(result.current.viewModel.tabs.some((tab) => tab.id === result.current.activeTab)).toBe(true);
      expect(result.current.viewModel.tabs.some((tab) => tab.id === 'lane-2')).toBe(false);
    });
  });

  it('creates class assignments and start times on confirm', async () => {
    const { result } = renderHook(() => useLaneAssignmentController());

    await act(async () => {
      await result.current.onConfirm();
    });

    expect(mocks.mockAssignLaneOrder).toHaveBeenCalledWith({
      startlistId: mockStartlistId,
      assignments: mockLaneAssignments,
    });
    expect(mocks.mockSetLoading).toHaveBeenCalledWith(mocks.mockDispatch, 'lanes', true);
    expect(mocks.mockSetLoading).toHaveBeenCalledWith(mocks.mockDispatch, 'lanes', false);
    expect(mocks.mockUpdateSnapshot).toHaveBeenCalledWith(mocks.mockDispatch, mockSnapshot);
    expect(mocks.mockCreateDefaultClassAssignments).toHaveBeenCalled();
    expect(mocks.mockUpdateClassAssignments).toHaveBeenCalled();
    expect(mocks.mockCalculateStartTimes).toHaveBeenCalledWith(
      expect.objectContaining({
        startOrderRules: mockStartOrderRules,
        worldRankingByClass: mockWorldRankingByClass,
      }),
    );
    expect(mocks.mockUpdateStartTimes).toHaveBeenCalled();
    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'lanes',
      expect.objectContaining({ level: 'success' }),
    );
    expect(mocks.mockNavigate).toHaveBeenCalledWith('/startlist/order');
  });

  it('reports an error when lane assignment submission fails', async () => {
    const error = new Error('network error');
    mocks.mockAssignLaneOrder.mockRejectedValue(error);

    const { result } = renderHook(() => useLaneAssignmentController());

    await act(async () => {
      await result.current.onConfirm();
    });

    expect(mocks.mockAssignLaneOrder).toHaveBeenCalled();
    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'lanes',
      expect.objectContaining({ level: 'error', text: error.message }),
    );
    expect(mocks.mockCreateDefaultClassAssignments).not.toHaveBeenCalled();
    expect(mocks.mockCalculateStartTimes).not.toHaveBeenCalled();
    expect(mocks.mockNavigate).not.toHaveBeenCalled();
  });
});

describe('useClassOrderController', () => {
  beforeEach(() => {
    mockClassAssignments = [{ classId: 'M21', playerOrder: ['1', '2'] }];
    mockStartTimes = [
      { playerId: '1', startTime: '2024-01-01T09:00:00Z', laneNumber: 1 },
      { playerId: '2', startTime: '2024-01-01T09:01:00Z', laneNumber: 1 },
    ];
  });

  it('selects the first available tab automatically', async () => {
    const { result } = renderHook(() => useClassOrderController());

    await waitFor(() => {
      expect(result.current.activeTab).not.toBe('');
    });
  });

  it('reorders players within a class', () => {
    mocks.mockUpdateClassPlayerOrder.mockImplementation(() => [{ classId: 'M21', playerOrder: ['2', '1'] }]);

    const { result } = renderHook(() => useClassOrderController());

    act(() => {
      result.current.onMove('M21', 0, 1);
    });

    expect(mocks.mockUpdateClassAssignments).toHaveBeenCalledWith(
      mocks.mockDispatch,
      [{ classId: 'M21', playerOrder: ['2', '1'] }],
      undefined,
      [],
      undefined,
    );
  });

  it('exports the startlist CSV through the provided helper', () => {
    const { result } = renderHook(() => useClassOrderController());

    act(() => {
      result.current.onExportCsv();
    });

    expect(mocks.mockDownloadStartlistCsv).toHaveBeenCalled();
    expect(mocks.mockSetLoading).toHaveBeenCalledWith(mocks.mockDispatch, 'startTimes', true);
  });

  it('finalizes the startlist and navigates to the link page', async () => {
    const classOrderSnapshot = { id: 'order' } as const;
    const assignedSnapshot = { id: 'assigned' } as const;
    const finalizedSnapshot = { id: mockStartlistId } as const;
    mocks.mockAssignPlayerOrder.mockResolvedValueOnce(classOrderSnapshot);
    mocks.mockAssignStartTimes.mockResolvedValueOnce(assignedSnapshot);
    mocks.mockFinalize.mockResolvedValueOnce(finalizedSnapshot);

    const { result } = renderHook(() => useClassOrderController());

    await act(async () => {
      await result.current.onFinalize();
    });

    expect(mocks.mockSetLoading).toHaveBeenCalledWith(mocks.mockDispatch, 'startTimes', true);
    expect(mocks.mockAssignPlayerOrder).toHaveBeenCalledWith({
      startlistId: mockStartlistId,
      assignments: mockClassAssignments,
    });
    expect(mocks.mockAssignStartTimes).toHaveBeenCalledWith({
      startlistId: mockStartlistId,
      startTimes: mockStartTimes,
    });
    expect(mocks.mockFinalize).toHaveBeenCalledWith({ startlistId: mockStartlistId });
    expect(mocks.mockUpdateSnapshot).toHaveBeenCalledWith(mocks.mockDispatch, classOrderSnapshot);
    expect(mocks.mockUpdateSnapshot).toHaveBeenCalledWith(mocks.mockDispatch, assignedSnapshot);
    expect(mocks.mockUpdateSnapshot).toHaveBeenCalledWith(mocks.mockDispatch, finalizedSnapshot);
    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'classes',
      expect.objectContaining({ level: 'success', text: 'クラス順序を送信しました。' }),
    );
    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'snapshot',
      expect.objectContaining({ level: 'info', text: 'スナップショットを更新しました。' }),
    );
    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'startTimes',
      expect.objectContaining({ level: 'success', text: 'スタートリストを確定しました。' }),
    );
    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'snapshot',
      expect.objectContaining({ level: 'success' }),
    );
    expect(mocks.mockFetchVersions).toHaveBeenCalledWith({ startlistId: mockStartlistId, limit: 1 });
    expect(mocks.mockAttachStartlist).toHaveBeenCalledWith({
      eventId: 'event-1',
      raceId: 'race-1',
      startlistLink: 'https://public.example.com/startlists/startlist-1/v/3',
      startlistUpdatedAt: '2024-04-05T09:00:00.000Z',
      startlistPublicVersion: 3,
    });
    expect(mocks.mockSetEventLinkStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      expect.objectContaining({ status: 'linking' }),
    );
    expect(mocks.mockSetEventLinkStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      expect.objectContaining({
        status: 'success',
        eventId: 'event-1',
        raceId: 'race-1',
        startlistLink: 'https://public.example.com/startlists/startlist-1/v/3',
        startlistPublicVersion: 3,
        startlistUpdatedAt: '2024-04-05T09:00:00.000Z',
      }),
    );
    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'snapshot',
      expect.objectContaining({ level: 'success', text: 'イベントにスタートリストを自動連携しました。' }),
    );
    expect(mocks.mockNavigate).toHaveBeenCalledWith('/startlist/link');
    expect(mocks.mockSetLoading).toHaveBeenCalledWith(mocks.mockDispatch, 'startTimes', false);
  });

  it('shows an error when start times are missing before finalize', async () => {
    mockStartTimes = [];

    const { result } = renderHook(() => useClassOrderController());

    await act(async () => {
      await result.current.onFinalize();
    });

    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'startTimes',
      expect.objectContaining({ level: 'error', text: 'スタート時間を先に作成してください。' }),
    );
    expect(mocks.mockAssignStartTimes).not.toHaveBeenCalled();
    expect(mocks.mockFinalize).not.toHaveBeenCalled();
  });

  it('requires class assignments before finalizing', async () => {
    mockClassAssignments = [];

    const { result } = renderHook(() => useClassOrderController());

    await act(async () => {
      await result.current.onFinalize();
    });

    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'classes',
      expect.objectContaining({ level: 'error', text: 'クラス順序を送信してから確定してください。' }),
    );
    expect(mocks.mockAssignPlayerOrder).not.toHaveBeenCalled();
    expect(mocks.mockAssignStartTimes).not.toHaveBeenCalled();
    expect(mocks.mockFinalize).not.toHaveBeenCalled();
  });
});
