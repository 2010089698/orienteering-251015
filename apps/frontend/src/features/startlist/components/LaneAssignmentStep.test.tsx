import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children, onDragEnd, ...props }: any) => (
      <actual.DndContext {...props} onDragEnd={onDragEnd}>
        {children}
        <button
          type="button"
          data-testid="simulate-drag-event"
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
          onClick={() =>
            onDragEnd?.({
              active: { id: 'M211' },
              over: { id: 'lane-2' },
            } as any)
          }
        />
      </actual.DndContext>
    ),
  };
});

import LaneAssignmentWorkflow from '../workflow/LaneAssignmentWorkflow';
const LaneAssignmentStep = LaneAssignmentWorkflow;
import { renderWithStartlistRouter } from '../test/test-utils';
import {
  useStartlistClassAssignments,
  useStartlistClassOrderSeed,
  useStartlistStatuses,
} from '../state/StartlistContext';
import { generateLaneAssignments } from '../utils/startlistUtils';

const ClassOrderPreview = () => {
  const classAssignments = useStartlistClassAssignments();
  const classOrderSeed = useStartlistClassOrderSeed();
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
  const statuses = useStartlistStatuses();
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

const splitEntries = [
  { id: 'entry-10', name: 'A', classId: 'M21', cardNo: '10' },
  { id: 'entry-11', name: 'B', classId: 'M21', cardNo: '11' },
  { id: 'entry-12', name: 'C', classId: 'M21', cardNo: '12' },
  { id: 'entry-13', name: 'D', classId: 'M21', cardNo: '13' },
  { id: 'entry-14', name: 'E', classId: 'W21', cardNo: '14' },
  { id: 'entry-15', name: 'F', classId: 'W21', cardNo: '15' },
];

const splitRules = [{ baseClassId: 'M21', partCount: 2, method: 'roundRobin' }];

const splitGeneration = generateLaneAssignments(
  splitEntries,
  baseSettings.laneCount,
  baseSettings.intervals.laneClass.milliseconds,
  { splitRules },
);

const splitLaneAssignments = splitGeneration.assignments;
const splitResult = splitGeneration.splitResult!;

describe('LaneAssignmentStep', () => {
  it('allows lane changes for split classes', async () => {
    renderWithStartlistRouter(<LaneAssignmentWorkflow />, {
      routerProps: { initialEntries: ['/startlist/lanes'] },
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries: splitEntries,
        laneAssignments: splitLaneAssignments,
        classSplitRules: splitRules,
        classSplitResult: splitResult,
      },
    });

    const select = screen.getByLabelText('M211 のレーン');
    await userEvent.selectOptions(select, '2');
    expect(await screen.findByText('クラス「M211」をレーン 2 に移動しました。')).toBeInTheDocument();
  });

  it('switches between overview and focused lane tabs with split metadata', async () => {
    renderWithStartlistRouter(<LaneAssignmentWorkflow />, {
      routerProps: { initialEntries: ['/startlist/lanes'] },
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries: splitEntries,
        laneAssignments: splitLaneAssignments,
        classSplitRules: splitRules,
        classSplitResult: splitResult,
      },
    });

    const overviewTab = screen.getByRole('tab', { name: 'すべてのレーン' });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    const overviewBoard = screen.getByTestId('lane-board');
    expect(within(overviewBoard).getAllByTestId(/lane-column-/)).toHaveLength(2);
    expect(within(overviewBoard).getByText('M211')).toBeInTheDocument();
    expect(within(overviewBoard).getByText('M21 • 分割 1 (1/2)')).toBeInTheDocument();

    const laneTwoTab = screen.getByRole('tab', { name: 'レーン 2' });
    await userEvent.click(laneTwoTab);

    const focusedBoard = screen.getByTestId('lane-board');
    const focusedColumns = within(focusedBoard).getAllByTestId(/lane-column-/);
    expect(focusedColumns).toHaveLength(1);
    expect(within(focusedColumns[0]).getByRole('heading', { name: 'レーン 2' })).toBeInTheDocument();
    expect(within(focusedColumns[0]).getByText('M212')).toBeInTheDocument();
    expect(within(focusedColumns[0]).getByText('M21 • 分割 2 (2/2)')).toBeInTheDocument();

    const laneSelect = screen.getByLabelText('M212 のレーン');
    await userEvent.selectOptions(laneSelect, '1');
    expect(await screen.findByText('クラス「M212」をレーン 1 に移動しました。')).toBeInTheDocument();

    await userEvent.click(overviewTab);
    const overviewBoardAfter = screen.getByTestId('lane-board');
    expect(within(overviewBoardAfter).getAllByTestId(/lane-column-/)).toHaveLength(2);
  });

  it('shows split helper text and competitor counts in previews', async () => {
    renderWithStartlistRouter(<LaneAssignmentWorkflow />, {
      routerProps: { initialEntries: ['/startlist/lanes'] },
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries: splitEntries,
        laneAssignments: splitLaneAssignments,
        classSplitRules: splitRules,
        classSplitResult: splitResult,
      },
    });

    const overviewBoard = screen.getByTestId('lane-board');
    expect(within(overviewBoard).getByText(/M21\s*•\s*分割 1 \(1\/2\)/)).toBeInTheDocument();
    const laneOne = within(overviewBoard).getByTestId('lane-column-1');
    const laneTwo = within(overviewBoard).getByTestId('lane-column-2');
    const laneOneM21Card = within(laneOne).getByRole('button', { name: /M211/ });
    const laneOneW21Card = within(laneOne).getByRole('button', { name: /W21/ });
    const laneTwoM21Card = within(laneTwo).getByRole('button', { name: /M212/ });
    expect(within(laneOneM21Card).getByText(/M21\s*•\s*分割 1 \(1\/2\)/)).toBeInTheDocument();
    expect(within(laneOneM21Card).getByText('2名')).toBeInTheDocument();
    expect(within(laneOneW21Card).getByText('2名')).toBeInTheDocument();
    expect(within(laneTwoM21Card).getByText('2名')).toBeInTheDocument();

    const preview = screen.getAllByTestId('lane-preview')[0];
    expect(within(preview).getByText('M21 • 分割 2 (2/2)')).toBeInTheDocument();
  });

  it('supports dragging split classes between lanes', async () => {
    const user = userEvent.setup();
    renderWithStartlistRouter(<LaneAssignmentWorkflow />, {
      routerProps: { initialEntries: ['/startlist/lanes'] },
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries: splitEntries,
        laneAssignments: splitLaneAssignments,
        classSplitRules: splitRules,
        classSplitResult: splitResult,
      },
    });

    const laneTwo = screen.getByTestId('lane-column-2');
    await user.click(screen.getByTestId('simulate-drag-event'));

    expect(await within(laneTwo).findByRole('button', { name: /M211/ })).toBeInTheDocument();
    expect(within(screen.getByTestId('lane-column-1')).queryByRole('button', { name: /M211/ })).toBeNull();
  });

  it('confirms assignments and generates next steps with split metadata', async () => {
    renderWithStartlistRouter(
      <>
        <LaneAssignmentStep />
        <ClassOrderPreview />
      </>,
      {
        routerProps: { initialEntries: ['/startlist/lanes'] },
        initialState: {
          startlistId: 'SL-1',
          settings: baseSettings,
          entries: splitEntries,
          laneAssignments: splitLaneAssignments,
          classSplitRules: splitRules,
          classSplitResult: splitResult,
        },
      },
    );

    await userEvent.click(screen.getByRole('button', { name: '割り当て確定（順番と時間を作成）' }));

    expect(await screen.findByText('クラス内の順序を自動で作成しました。')).toBeInTheDocument();
    expect(await screen.findByText('スタート時間を割り当てました。')).toBeInTheDocument();
    expect(await screen.findByTestId('class-order-M211')).toBeInTheDocument();
    expect(await screen.findByTestId('class-order-M212')).toBeInTheDocument();
  });

  it('blocks generation when required world ranking CSVs are missing', async () => {
    renderWithStartlistRouter(
      <>
        <LaneAssignmentStep />
        <StartOrderStatusPreview />
      </>,
      {
        routerProps: { initialEntries: ['/startlist/lanes'] },
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
  });

  it('preserves generated class order when re-confirming step 2', async () => {
    renderWithStartlistRouter(
      <>
        <LaneAssignmentStep />
        <ClassOrderPreview />
      </>,
      {
        routerProps: { initialEntries: ['/startlist/lanes'] },
        initialState: {
          startlistId: 'SL-1',
          settings: baseSettings,
          entries: splitEntries,
          laneAssignments: splitLaneAssignments,
          classSplitRules: splitRules,
          classSplitResult: splitResult,
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
  });
});
