import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import InputStepWorkflow from '../workflow/InputStepWorkflow';
import { renderWithStartlistRouter } from '../test/test-utils';
import {
  useStartlistClassSplitResult,
  useStartlistClassSplitRules,
  useStartlistLaneAssignments,
} from '../state/StartlistContext';
import * as SettingsFormHook from '../hooks/useSettingsForm';

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
  const classSplitRules = useStartlistClassSplitRules();
  const laneAssignments = useStartlistLaneAssignments();
  const classSplitResult = useStartlistClassSplitResult();
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
    renderWithStartlistRouter(<InputStepWorkflow />, {
      routerProps: { initialEntries: ['/startlist/input'] },
    });

    await userEvent.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));

    expect(await screen.findByText('参加者を1人以上登録してください。')).toBeInTheDocument();
  });

  it('shows validation errors from the settings form when inputs are invalid', async () => {
    const useSettingsFormSpy = vi.spyOn(SettingsFormHook, 'useSettingsForm');
    const submitMock = vi.fn(() => ({ error: 'レーン数は 1 以上の整数で入力してください。' }));
    useSettingsFormSpy.mockReturnValue({
      startTime: '2024-01-01T09:00',
      laneIntervalMs: 0,
      playerIntervalMs: 60000,
      laneCount: 1,
      avoidConsecutiveClubs: true,
      laneIntervalOptions: [{ label: 'なし', value: 0 }],
      playerIntervalOptions: [{ label: '1分', value: 60000 }],
      status: { level: 'error', text: 'レーン数は 1 以上の整数で入力してください。' },
      validationError: 'レーン数は 1 以上の整数で入力してください。',
      onStartTimeChange: vi.fn(),
      onLaneIntervalChange: vi.fn(),
      onPlayerIntervalChange: vi.fn(),
      onLaneCountChange: vi.fn(),
      onAvoidConsecutiveClubsChange: vi.fn(),
      submit: submitMock,
    } as ReturnType<typeof SettingsFormHook.useSettingsForm>);

    renderWithStartlistRouter(<InputStepWorkflow />, {
      routerProps: { initialEntries: ['/startlist/input'] },
    });

    await userEvent.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));

    expect(submitMock).toHaveBeenCalled();
    expect(await screen.findByText('レーン数は 1 以上の整数で入力してください。')).toBeInTheDocument();

    useSettingsFormSpy.mockRestore();
  });

  it('generates lane assignments and navigates forward', async () => {
    renderWithStartlistRouter(<InputStepWorkflow />, {
      routerProps: { initialEntries: ['/startlist/input'] },
      initialState: {
        startlistId: 'SL-1',
        settings: baseSettings,
        entries: sampleEntries,
      },
    });

    await userEvent.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));

    expect(await screen.findByText('自動でレーン割り当てを作成しました。')).toBeInTheDocument();
  });

  it('allows adding and removing class split rows', async () => {
    renderWithStartlistRouter(<InputStepWorkflow />, {
      routerProps: { initialEntries: ['/startlist/input'] },
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
    renderWithStartlistRouter(<InputStepWorkflow />, {
      routerProps: { initialEntries: ['/startlist/input'] },
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
    renderWithStartlistRouter(
      <>
        <InputStepWorkflow />
        <StatePreview />
      </>,
      {
        routerProps: { initialEntries: ['/startlist/input'] },
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
    const splitRulesPreview = screen.getByTestId('input-step-split-rules').textContent ?? '';
    expect(splitRulesPreview).toContain('"baseClassId":"SP"');

    const laneAssignmentsPreview = screen.getByTestId('input-step-lane-assignments').textContent ?? '';
    expect(laneAssignmentsPreview).toContain('SP-A');
    expect(laneAssignmentsPreview).toContain('SP-B');

    const signature = screen.getByTestId('input-step-split-signature').textContent;
    expect(signature).not.toBe('none');
  });
});
