import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ClassSplitSettingsPanel from '../ClassSplitSettingsPanel';
import { createWorldRankingInitialState, renderWithStartlist } from '../../test/test-utils';
import {
  useStartlistClassSplitRules,
  useStartlistStatuses,
  setStartOrderRules,
  updateClassWorldRanking,
} from '../../state/StartlistContext';

const entries = [
  { id: 'entry-1', name: 'Runner 1', classId: 'M21', cardNo: '1' },
  { id: 'entry-2', name: 'Runner 2', classId: 'W21', cardNo: '2' },
  { id: 'entry-3', name: 'Runner 3', classId: 'M21', cardNo: '3' },
];

const ClassSplitRulesPreview = () => {
  const classSplitRules = useStartlistClassSplitRules();
  return <pre data-testid="class-split-rules">{JSON.stringify(classSplitRules)}</pre>;
};

const ClassSplitStatusPreview = () => {
  const statuses = useStartlistStatuses();
  return <span data-testid="class-split-status">{statuses.classSplit.text}</span>;
};

describe('ClassSplitSettingsPanel', () => {
  it('allows configuring class split rules', async () => {
    const user = userEvent.setup();

    renderWithStartlist(
      <>
        <ClassSplitSettingsPanel />
        <ClassSplitRulesPreview />
        <ClassSplitStatusPreview />
      </>,
      {
        initialState: {
          entries,
          startlistId: 'SL-1',
        },
      },
    );

    const status = await screen.findByTestId('class-split-status');
    expect(status).toHaveTextContent('クラス分割は設定されていません。');

    const classSelect = screen.getByLabelText('基準クラス');
    await user.selectOptions(classSelect, 'M21');

    const partInput = screen.getByLabelText('分割数');
    await user.clear(partInput);
    await user.type(partInput, '3');

    const methodSelect = screen.getByLabelText('分割方法');
    await user.selectOptions(methodSelect, 'random');

    await waitFor(() =>
      expect(status).toHaveTextContent('クラス分割設定: M21 → 3組（ランダムに分割）'),
    );

    const preview = screen.getByTestId('class-split-rules').textContent ?? '';
    expect(preview).toContain('"baseClassId":"M21"');
    expect(preview).toContain('"partCount":3');
    expect(preview).toContain('"method":"random"');
  });

  it('reports invalid split counts', async () => {
    const user = userEvent.setup();

    renderWithStartlist(
      <>
        <ClassSplitSettingsPanel />
        <ClassSplitStatusPreview />
      </>,
      {
        initialState: {
          entries,
          startlistId: 'SL-1',
        },
      },
    );

    const classSelect = screen.getByLabelText('基準クラス');
    await user.selectOptions(classSelect, 'M21');

    const partInput = screen.getByLabelText('分割数');
    await user.clear(partInput);
    await user.type(partInput, '1');

    const status = await screen.findByTestId('class-split-status');
    await waitFor(() =>
      expect(status).toHaveTextContent('分割数は2以上の整数を入力してください: M21'),
    );
  });

  it('shows an error when duplicate classes are configured', async () => {
    renderWithStartlist(
      <>
        <ClassSplitSettingsPanel />
        <ClassSplitStatusPreview />
      </>,
      {
        initialState: {
          entries,
          startlistId: 'SL-1',
          classSplitRules: [
            { baseClassId: 'M21', partCount: 2, method: 'random' },
            { baseClassId: 'M21', partCount: 3, method: 'random' },
          ],
        },
      },
    );

    const status = await screen.findByTestId('class-split-status');
    await waitFor(() =>
      expect(status).toHaveTextContent('同じクラスが複数回設定されています: M21'),
    );
  });

  it('enables ranking methods only when prerequisites are satisfied', async () => {
    const user = userEvent.setup();
    let dispatchRef: Parameters<typeof setStartOrderRules>[0] | undefined;
    renderWithStartlist(
      <>
        <ClassSplitSettingsPanel />
        <ClassSplitStatusPreview />
      </>,
      {
        initialState: {
          entries,
          startlistId: 'SL-1',
          startOrderRules: [{ id: 'rule', classId: 'M21', method: 'random' }],
        },
        initialize: (dispatch) => {
          dispatchRef = dispatch as never;
        },
      },
    );

    const classSelect = screen.getByLabelText('基準クラス');
    await user.selectOptions(classSelect, 'M21');

    const methodSelect = screen.getByLabelText('分割方法');
    const topBottomOption = screen.getByRole('option', { name: 'ランキング上位/下位で分割' });
    const balancedOption = screen.getByRole('option', { name: 'ランキング均等分割' });
    expect(topBottomOption).toBeDisabled();
    expect(balancedOption).toBeDisabled();

    await act(async () => {
      if (dispatchRef) {
        setStartOrderRules(dispatchRef, [
          { id: 'rule', classId: 'M21', method: 'worldRanking', csvName: 'ranking.csv' },
        ]);
      }
    });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'ランキング上位/下位で分割' })).toBeDisabled();
    });

    await act(async () => {
      if (dispatchRef) {
        updateClassWorldRanking(
          dispatchRef,
          'M21',
          new Map([
            ['iof-1', 1],
            ['iof-2', 2],
          ]),
        );
      }
    });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'ランキング上位/下位で分割' })).not.toBeDisabled();
      expect(screen.getByRole('option', { name: 'ランキング均等分割' })).not.toBeDisabled();
    });

    await user.selectOptions(methodSelect, 'rankingBalanced');

    const status = await screen.findByTestId('class-split-status');
    await waitFor(() =>
      expect(status).toHaveTextContent('クラス分割設定: M21 → 2組（ランキング均等分割）'),
    );
  });

  it('locks split count for rankingTopBottom and reverts to random when prerequisites break', async () => {
    const user = userEvent.setup();
    let dispatchRef: Parameters<typeof setStartOrderRules>[0] | undefined;
    renderWithStartlist(
      <>
        <ClassSplitSettingsPanel />
        <ClassSplitRulesPreview />
        <ClassSplitStatusPreview />
      </>,
      {
        initialState: {
          entries,
          startlistId: 'SL-1',
          ...createWorldRankingInitialState('M21', {
            csvName: 'ranking.csv',
            ruleId: 'rule',
            entries: [
              ['iof-1', 5],
              ['iof-2', 10],
              ['iof-3', 15],
            ],
          }),
        },
        initialize: (dispatch) => {
          dispatchRef = dispatch as never;
        },
      },
    );

    const classSelect = screen.getByLabelText('基準クラス');
    const partInput = screen.getByLabelText('分割数');
    const methodSelect = screen.getByLabelText('分割方法');

    await user.selectOptions(classSelect, 'M21');
    await user.clear(partInput);
    await user.type(partInput, '4');
    expect(partInput).toHaveValue(4);

    await user.selectOptions(methodSelect, 'rankingTopBottom');

    await waitFor(() => expect(partInput).toHaveValue(2));
    expect(partInput).toBeDisabled();
    expect(methodSelect).toHaveValue('rankingTopBottom');
    const status = await screen.findByTestId('class-split-status');
    await waitFor(() =>
      expect(status).toHaveTextContent('クラス分割設定: M21 → 2組（ランキング上位/下位で分割）'),
    );

    await act(async () => {
      if (dispatchRef) {
        setStartOrderRules(dispatchRef, [{ id: 'rule', classId: 'M21', method: 'random' }]);
      }
    });

    await waitFor(() => expect(methodSelect).toHaveValue('random'));
    expect(partInput).not.toBeDisabled();
    await waitFor(() => expect(status).toHaveTextContent('クラス分割設定: M21 → 2組（ランダムに分割）'));
  });
});
