import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import StartTimesPanel from './StartTimesPanel';
import { renderWithStartlist } from '../test/test-utils';
import type { Entry } from '../state/types';
import type { ClassAssignmentDto, StartTimeDto } from '@startlist-management/application';

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

const classAssignments: ClassAssignmentDto[] = [
  {
    laneNumber: 1,
    classId: 'SP1',
    playerOrder: ['player-1'],
  },
];

describe('StartTimesPanel', () => {
  let originalBlob: typeof Blob;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-04-01T00:00:00.000Z'));
    originalBlob = Blob;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (URL as Record<string, unknown>).createObjectURL;
    delete (URL as Record<string, unknown>).revokeObjectURL;
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: originalBlob,
    });
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
});
