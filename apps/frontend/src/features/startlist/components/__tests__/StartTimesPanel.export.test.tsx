import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { StartTimeDto } from '@startlist-management/application';
import StartTimesPanel from '../StartTimesPanel';
import { renderWithStartlist } from '../../test/test-utils';
import { updateStartTimes } from '../../state/StartlistContext';
import { buildStartlistExportRows, exportRowToCsvLine } from '../../utils/startlistExport';
import type { StartlistExportRow } from '../../utils/startlistExport';

type StartlistExportModule = typeof import('../../utils/startlistExport');

vi.mock('../../utils/startlistExport', () => ({
  buildStartlistExportRows: vi.fn(),
  exportRowToCsvLine: vi.fn(),
}));

const buildStartlistExportRowsMock =
  buildStartlistExportRows as vi.MockedFunction<StartlistExportModule['buildStartlistExportRows']>;
const exportRowToCsvLineMock =
  exportRowToCsvLine as vi.MockedFunction<StartlistExportModule['exportRowToCsvLine']>;

describe('StartTimesPanel CSV export status handling', () => {
  const sampleStartTimes: StartTimeDto[] = [
    { playerId: 'player-1', laneNumber: 1, startTime: '2024-05-01T00:00:00.000Z' },
  ];

  beforeEach(() => {
    buildStartlistExportRowsMock.mockReset();
    exportRowToCsvLineMock.mockReset();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mock'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    delete (URL as Record<string, unknown>).createObjectURL;
    delete (URL as Record<string, unknown>).revokeObjectURL;
    vi.restoreAllMocks();
  });

  it('sets info status when CSV export succeeds', async () => {
    const rows: StartlistExportRow[] = [
      { classId: 'M21', startNumber: '001', name: 'Alice', club: 'Alpha', cardNo: '1001' },
    ];
    buildStartlistExportRowsMock.mockReturnValue(rows);
    exportRowToCsvLineMock.mockImplementation(() => 'line-1');
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderWithStartlist(<StartTimesPanel />, {
      initialState: {
        startTimes: sampleStartTimes,
        statuses: { startTimes: { level: 'idle', text: '' } },
      },
    });

    const button = screen.getByRole('button', { name: 'CSV をエクスポート' });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await waitFor(() => expect(clickMock).toHaveBeenCalled());
    const message = await screen.findByText('1 件のスタート時間をエクスポートしました。');
    expect(message.closest('p')).toHaveClass('status--info');
  });

  it('sets error status when CSV export throws', async () => {
    buildStartlistExportRowsMock.mockImplementation(() => {
      throw new Error('unexpected failure');
    });

    renderWithStartlist(<StartTimesPanel />, {
      initialState: {
        startTimes: sampleStartTimes,
        statuses: { startTimes: { level: 'idle', text: '' } },
      },
    });

    const button = screen.getByRole('button', { name: 'CSV をエクスポート' });
    fireEvent.click(button);

    const message = await screen.findByText('unexpected failure');
    expect(message.closest('p')).toHaveClass('status--error');
  });

  it('enables the export button only when start times exist', async () => {
    let capturedDispatch: Parameters<typeof updateStartTimes>[0] | undefined;

    renderWithStartlist(<StartTimesPanel />, {
      initialize: (dispatch) => {
        capturedDispatch = dispatch;
      },
      initialState: {
        startTimes: [],
        statuses: { startTimes: { level: 'idle', text: '' } },
      },
    });

    const button = screen.getByRole('button', { name: 'CSV をエクスポート' });
    expect(button).toBeDisabled();

    await waitFor(() => expect(typeof capturedDispatch).toBe('function'));

    await act(async () => {
      updateStartTimes(capturedDispatch!, sampleStartTimes);
    });

    expect(button).toBeEnabled();
  });
});
