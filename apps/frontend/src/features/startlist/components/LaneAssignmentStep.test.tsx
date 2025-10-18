import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LaneAssignmentStep from './LaneAssignmentStep';
import { renderWithStartlist } from '../test/test-utils';
import { useStartlistState } from '../state/StartlistContext';

const ClassOrderPreview = () => {
  const { classAssignments, classOrderSeed } = useStartlistState();
  return (
    <div data-testid="class-order-preview" data-seed={classOrderSeed ?? ''}>
      {classAssignments.map((assignment) => (
        <div
          key={assignment.classId}
          data-testid={`class-order-${assignment.classId}`}
          data-order={assignment.playerOrder.join(',')}
        />
      ))}
    </div>
  );
};

const StartOrderStatusPreview = () => {
  const { statuses } = useStartlistState();
  return <div data-testid="start-order-status">{statuses.startOrder.text}</div>;
};

const baseSettings = {
  eventId: 'event-1',
  startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
  intervals: {
    laneClass: { milliseconds: 60000 },
    classPlayer: { milliseconds: 45000 },
  },
  laneCount: 2,
};

const laneAssignments = [
  { laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } },
  { laneNumber: 2, classOrder: ['W21'], interval: { milliseconds: 60000 } },
];

const entries = [
  { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '1' },
  { id: 'entry-2', name: 'B', classId: 'W21', cardNo: '2' },
];

describe('LaneAssignmentStep', () => {
  it('allows lane changes', async () => {
    renderWithStartlist(<LaneAssignmentStep onBack={() => {}} onConfirm={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries,
        laneAssignments,
      },
    });

    const select = screen.getByLabelText('M21 のレーン');
    await userEvent.selectOptions(select, '2');
    expect(await screen.findByText('クラス「M21」をレーン 2 に移動しました。')).toBeInTheDocument();
  });

  it('switches between overview and focused lane tabs', async () => {
    renderWithStartlist(<LaneAssignmentStep onBack={() => {}} onConfirm={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries,
        laneAssignments,
      },
    });

    const overviewTab = screen.getByRole('tab', { name: 'すべてのレーン' });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    const overviewBoard = screen.getByTestId('lane-board');
    expect(within(overviewBoard).getAllByTestId(/lane-column-/)).toHaveLength(2);

    const laneTwoTab = screen.getByRole('tab', { name: 'レーン 2' });
    await userEvent.click(laneTwoTab);

    const focusedBoard = screen.getByTestId('lane-board');
    const focusedColumns = within(focusedBoard).getAllByTestId(/lane-column-/);
    expect(focusedColumns).toHaveLength(1);
    expect(within(focusedColumns[0]).getByRole('heading', { name: 'レーン 2' })).toBeInTheDocument();
    expect(within(focusedColumns[0]).getByText('W21')).toBeInTheDocument();

    const laneSelect = screen.getByLabelText('W21 のレーン');
    await userEvent.selectOptions(laneSelect, '1');
    expect(await screen.findByText('クラス「W21」をレーン 1 に移動しました。')).toBeInTheDocument();

    await userEvent.click(overviewTab);
    const overviewBoardAfter = screen.getByTestId('lane-board');
    expect(within(overviewBoardAfter).getAllByTestId(/lane-column-/)).toHaveLength(2);
  });

  it('confirms assignments and generates next steps', async () => {
    const onConfirm = vi.fn();
    renderWithStartlist(<LaneAssignmentStep onBack={() => {}} onConfirm={onConfirm} />, {
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries,
        laneAssignments,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: '割り当て確定（順番と時間を作成）' }));

    expect(await screen.findByText('クラス内の順序を自動で作成しました。')).toBeInTheDocument();
    expect(await screen.findByText('スタート時間を割り当てました。')).toBeInTheDocument();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocks generation when required world ranking CSVs are missing', async () => {
    const onConfirm = vi.fn();
    renderWithStartlist(
      <>
        <LaneAssignmentStep onBack={() => {}} onConfirm={onConfirm} />
        <StartOrderStatusPreview />
      </>,
      {
        initialState: {
          startlistId: 'SL-1',
          settings: baseSettings,
          entries,
          laneAssignments,
          startOrderRules: [{ id: 'rule-1', classId: 'M21', method: 'worldRanking' }],
        },
      },
    );

    await userEvent.click(screen.getByRole('button', { name: '割り当て確定（順番と時間を作成）' }));

    expect(
      await screen.findByText('世界ランキングの CSV を読み込んでからクラス内順序を作成してください。'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('start-order-status')).toHaveTextContent(
      '世界ランキング方式のクラス (M21) の CSV が読み込まれていません。',
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('preserves generated class order when re-confirming step 2', async () => {
    const onConfirm = vi.fn();
    renderWithStartlist(
      <>
        <LaneAssignmentStep onBack={() => {}} onConfirm={onConfirm} />
        <ClassOrderPreview />
      </>,
      {
        initialState: {
          startlistId: 'SL-1',
          settings: baseSettings,
          entries,
          laneAssignments,
        },
      },
    );

    await userEvent.click(screen.getByRole('button', { name: '割り当て確定（順番と時間を作成）' }));

    const preview = await screen.findByTestId('class-order-preview');
    const initialSeed = preview.getAttribute('data-seed');
    expect(initialSeed).not.toBe('');
    const initialOrders = within(preview)
      .getAllByTestId(/class-order-/)
      .map((node) => ({
        id: node.getAttribute('data-testid')?.replace('class-order-', '') ?? '',
        order: node.getAttribute('data-order'),
      }));

    await userEvent.click(screen.getByRole('button', { name: '割り当て確定（順番と時間を作成）' }));

    const previewAfter = await screen.findByTestId('class-order-preview');
    const secondSeed = previewAfter.getAttribute('data-seed');
    const secondOrders = within(previewAfter)
      .getAllByTestId(/class-order-/)
      .map((node) => ({
        id: node.getAttribute('data-testid')?.replace('class-order-', '') ?? '',
        order: node.getAttribute('data-order'),
      }));

    expect(secondSeed).toBe(initialSeed);
    expect(secondOrders).toEqual(initialOrders);
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
