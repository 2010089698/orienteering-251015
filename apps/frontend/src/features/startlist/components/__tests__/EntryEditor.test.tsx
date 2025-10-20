import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import EntryForm from '../EntryForm';
import EntryTable from '../EntryTable';
import {
  removeEntry,
  useStartlistDispatch,
  useStartlistEntries,
  useSetStartlistEditingEntryId,
} from '../../state/StartlistContext';
import { renderWithStartlist } from '../../test/test-utils';

const EntryEditorHarness = () => {
  const entries = useStartlistEntries();
  const dispatch = useStartlistDispatch();
  const setEditingEntryId = useSetStartlistEditingEntryId();

  return (
    <>
      <EntryForm />
      <EntryTable
        entries={entries}
        onEdit={setEditingEntryId}
        onRemove={(id) => removeEntry(dispatch, id)}
      />
    </>
  );
};

describe('Entry editing integration', () => {
  const sampleEntries = [
    { id: 'entry-1', name: 'Alice', classId: 'W21', cardNo: '1001', club: 'Alpha', iofId: 'IOF001' },
    { id: 'entry-2', name: 'Bob', classId: 'M21', cardNo: '1002', club: 'Beta' },
  ];

  it('edits an entry through the form', async () => {
    renderWithStartlist(<EntryEditorHarness />, {
      initialState: { entries: sampleEntries },
    });

    const [firstEditButton] = await screen.findAllByRole('button', { name: '編集' });
    await userEvent.click(firstEditButton);

    const nameInput = await screen.findByLabelText('選手名');
    expect(nameInput).toHaveValue('Alice');

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Alice Updated');

    const cardInput = screen.getByLabelText('カード番号');
    await userEvent.clear(cardInput);
    await userEvent.type(cardInput, '2001');

    await userEvent.click(screen.getByRole('button', { name: '参加者を更新' }));

    expect(screen.getByRole('button', { name: '参加者を追加' })).toBeInTheDocument();
    expect(screen.getByText('Alice Updated')).toBeInTheDocument();
    expect(screen.getByText('2001')).toBeInTheDocument();
    expect(screen.queryByText('1001')).not.toBeInTheDocument();
  });

  it('cancels editing and resets the form state', async () => {
    renderWithStartlist(<EntryEditorHarness />, {
      initialState: { entries: sampleEntries, editingEntryId: 'entry-2' },
    });

    const nameInput = await screen.findByLabelText('選手名');
    expect(nameInput).toHaveValue('Bob');
    expect(screen.getByRole('button', { name: '参加者を更新' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '編集をキャンセル' }));

    expect(screen.getByRole('button', { name: '参加者を追加' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '参加者を更新' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('選手名')).toHaveValue('');
  });
});
