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
}));

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
  setLoading: mocks.mockSetLoading,
}));

vi.mock('../../hooks/useSettingsForm', () => ({
  useSettingsForm: () => ({
    fields: {
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
      intervals: { laneClass: { milliseconds: 60000 } },
      laneCount: 2,
    },
  });
  mocks.mockGenerateLaneAssignments.mockReturnValue({
    assignments: [
      { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
    ],
    splitResult: undefined,
  });
  mocks.mockCreateDefaultClassAssignments.mockReturnValue({
    assignments: [{ classId: 'M21', playerOrder: ['1'] }],
    seed: 'seed-1',
    warnings: [],
    splitResult: undefined,
  });
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
};

beforeEach(() => {
  resetState();
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

  it('validates and navigates to the lane step on completion', () => {
    const { result } = renderHook(() => useInputStepController());

    act(() => {
      result.current.onComplete();
    });

    expect(mocks.mockGenerateLaneAssignments).toHaveBeenCalled();
    expect(mocks.mockUpdateLaneAssignments).toHaveBeenCalled();
    expect(mocks.mockSetStatus).toHaveBeenCalledWith(
      mocks.mockDispatch,
      'lanes',
      expect.objectContaining({ level: 'success' }),
    );
    expect(mocks.mockNavigate).toHaveBeenCalledWith('/startlist/lanes');
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

  it('creates class assignments and start times on confirm', () => {
    const { result } = renderHook(() => useLaneAssignmentController());

    act(() => {
      result.current.onConfirm();
    });

    expect(mocks.mockCreateDefaultClassAssignments).toHaveBeenCalled();
    expect(mocks.mockUpdateClassAssignments).toHaveBeenCalled();
    expect(mocks.mockUpdateStartTimes).toHaveBeenCalled();
    expect(mocks.mockNavigate).toHaveBeenCalledWith('/startlist/order');
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
});
