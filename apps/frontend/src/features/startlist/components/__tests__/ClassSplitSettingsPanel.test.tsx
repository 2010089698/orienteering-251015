import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ClassSplitSettingsPanel from '../ClassSplitSettingsPanel';
import { renderWithStartlist } from '../../test/test-utils';
import { useStartlistState } from '../../state/StartlistContext';

const entries = [
  { id: 'entry-1', name: 'Runner 1', classId: 'M21', cardNo: '1' },
  { id: 'entry-2', name: 'Runner 2', classId: 'W21', cardNo: '2' },
  { id: 'entry-3', name: 'Runner 3', classId: 'M21', cardNo: '3' },
];

const ClassSplitRulesPreview = () => {
  const { classSplitRules } = useStartlistState();
  return <pre data-testid="class-split-rules">{JSON.stringify(classSplitRules)}</pre>;
};

const ClassSplitStatusPreview = () => {
  const { statuses } = useStartlistState();
  return <span data-testid="class-split-status">{statuses.classSplit.text}</span>;
};

describe('ClassSplitSettingsPanel', () => {
  it('allows configuring class split rules', async () => {
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

    await waitFor(() =>
      expect(screen.getByTestId('class-split-status')).toHaveTextContent('クラス分割は設定されていません。'),
    );

    const classSelect = screen.getByLabelText('基準クラス');
    await userEvent.selectOptions(classSelect, 'M21');

    const partInput = screen.getByLabelText('分割数');
    await userEvent.clear(partInput);
    await userEvent.type(partInput, '3');

    const methodSelect = screen.getByLabelText('分割方法');
    await userEvent.selectOptions(methodSelect, 'balanced');

    await waitFor(() =>
      expect(screen.getByTestId('class-split-status')).toHaveTextContent(
        'クラス分割設定: M21 → 3組（同人数を目指す）',
      ),
    );

    const preview = screen.getByTestId('class-split-rules').textContent ?? '';
    expect(preview).toContain('"baseClassId":"M21"');
    expect(preview).toContain('"partCount":3');
    expect(preview).toContain('"method":"balanced"');
  });

  it('reports invalid split counts', async () => {
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
    await userEvent.selectOptions(classSelect, 'M21');

    const partInput = screen.getByLabelText('分割数');
    await userEvent.clear(partInput);
    await userEvent.type(partInput, '1');

    await waitFor(() =>
      expect(screen.getByTestId('class-split-status')).toHaveTextContent(
        '分割数は2以上の整数を入力してください: M21',
      ),
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
            { baseClassId: 'M21', partCount: 3, method: 'balanced' },
          ],
        },
      },
    );

    await waitFor(() =>
      expect(screen.getByTestId('class-split-status')).toHaveTextContent(
        '同じクラスが複数回設定されています: M21',
      ),
    );
  });
});
