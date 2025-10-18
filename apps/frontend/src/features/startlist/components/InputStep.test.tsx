import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import InputStep from './InputStep';
import { renderWithStartlist } from '../test/test-utils';
import { useStartlistState } from '../state/StartlistContext';

const baseSettings = {
  eventId: 'event-1',
  startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
  intervals: {
    laneClass: { milliseconds: 0 },
    classPlayer: { milliseconds: 45000 },
  },
  laneCount: 2,
};

const sampleEntries = [
  { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '1' },
  { id: 'entry-2', name: 'B', classId: 'W21', cardNo: '2' },
];

const splitEntries = [
  { id: 'split-1', name: 'One', classId: 'SP', cardNo: '1' },
  { id: 'split-2', name: 'Two', classId: 'SP', cardNo: '2' },
  { id: 'split-3', name: 'Three', classId: 'SP', cardNo: '3' },
  { id: 'split-4', name: 'Four', classId: 'SP', cardNo: '4' },
];

const StatePreview = () => {
  const { classSplitRules, laneAssignments, classSplitResult } = useStartlistState();
  return (
    <>
      <pre data-testid="input-step-split-rules">{JSON.stringify(classSplitRules)}</pre>
      <pre data-testid="input-step-lane-assignments">{JSON.stringify(laneAssignments)}</pre>
      <span data-testid="input-step-split-signature">{classSplitResult?.signature ?? 'none'}</span>
    </>
  );
};

describe('InputStep', () => {
  it('blocks progress when no entries are registered', async () => {
    renderWithStartlist(<InputStep onComplete={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));

    expect(await screen.findByText('参加者を1人以上登録してください。')).toBeInTheDocument();
  });

  it('shows validation errors from the settings form when inputs are invalid', async () => {
    renderWithStartlist(<InputStep onComplete={() => {}} />);

    await userEvent.clear(screen.getByLabelText('開始時刻'));
    await userEvent.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));

    expect(await screen.findByText('開始時刻を入力してください。')).toBeInTheDocument();
  });

  it('generates lane assignments and calls onComplete', async () => {
    let completed = false;
    renderWithStartlist(<InputStep onComplete={() => (completed = true)} />, {
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries: sampleEntries,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));

    expect(await screen.findByText('自動でレーン割り当てを作成しました。')).toBeInTheDocument();
    expect(completed).toBe(true);
  });

  it('allows adding and removing class split rows', async () => {
    renderWithStartlist(<InputStep onComplete={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries: splitEntries,
      },
    });

    const panel = screen.getByRole('region', { name: 'クラス分割設定' });

    expect(within(panel).getAllByLabelText('基準クラス')).toHaveLength(1);

    await userEvent.click(within(panel).getByRole('button', { name: '行を追加' }));
    expect(await within(panel).findAllByLabelText('基準クラス')).toHaveLength(2);

    const removeButtons = within(panel).getAllByRole('button', { name: '行を削除' });
    await userEvent.click(removeButtons[1]);

    expect(within(panel).getAllByLabelText('基準クラス')).toHaveLength(1);
  });

  it('surfaces validation errors for invalid class split counts', async () => {
    renderWithStartlist(<InputStep onComplete={() => {}} />, {
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries: splitEntries,
      },
    });

    const classSelect = screen.getByLabelText('基準クラス');
    await userEvent.selectOptions(classSelect, 'SP');

    const partInput = screen.getByLabelText('分割数');
    await userEvent.clear(partInput);
    await userEvent.type(partInput, '1');

    expect(
      await screen.findByText('分割数は2以上の整数を入力してください: SP'),
    ).toBeInTheDocument();
  });

  it('passes class split rules to lane generation before completing step 1', async () => {
    let completed = false;
    renderWithStartlist(
      <>
        <InputStep onComplete={() => (completed = true)} />
        <StatePreview />
      </>,
      {
        initialState: {
          startlistId: 'SL-1',
          settings: baseSettings,
          entries: splitEntries,
        },
      },
    );

    const classSelect = screen.getByLabelText('基準クラス');
    await userEvent.selectOptions(classSelect, 'SP');

    const partInput = screen.getByLabelText('分割数');
    await userEvent.clear(partInput);
    await userEvent.type(partInput, '2');

    await userEvent.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));

    expect(await screen.findByText('自動でレーン割り当てを作成しました。')).toBeInTheDocument();
    expect(completed).toBe(true);

    const splitRulesPreview = screen.getByTestId('input-step-split-rules').textContent ?? '';
    expect(splitRulesPreview).toContain('"baseClassId":"SP"');

    const laneAssignmentsPreview = screen.getByTestId('input-step-lane-assignments').textContent ?? '';
    expect(laneAssignmentsPreview).toContain('SP-A');
    expect(laneAssignmentsPreview).toContain('SP-B');

    const signature = screen.getByTestId('input-step-split-signature').textContent;
    expect(signature).not.toBe('none');
  });
});
