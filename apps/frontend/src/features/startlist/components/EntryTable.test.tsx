import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EntryTable from './EntryTable';
import { renderWithStartlist } from '../test/test-utils';

describe('EntryTable', () => {
  it('shows empty state when no entries exist', () => {
    renderWithStartlist(<EntryTable entries={[]} emptyMessage="登録済みの参加者はまだいません。" />);

    expect(screen.getByText('登録済みの参加者はまだいません。')).toBeInTheDocument();
  });

  it('renders IOF ID column when entries include values', () => {
    renderWithStartlist(
      <EntryTable
        entries={[
          { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '123', iofId: 'ABC123' },
        ]}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'IOF ID' })).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    expect(within(firstDataRow).getByText('ABC123')).toBeInTheDocument();
  });

  it('invokes onRemove when delete is pressed', async () => {
    const handleRemove = vi.fn();
    renderWithStartlist(
      <EntryTable
        entries={[
          { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '123', iofId: 'ABC123' },
          { id: 'entry-2', name: 'B', classId: 'W21', cardNo: '456' },
        ]}
        onRemove={handleRemove}
      />,
    );

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2 entries

    const secondRow = rows[2];
    await userEvent.click(within(secondRow).getByRole('button', { name: '削除' }));

    expect(handleRemove).toHaveBeenCalledWith('entry-2');
  });

  it('invokes onEdit when edit is pressed', async () => {
    const handleEdit = vi.fn();
    renderWithStartlist(
      <EntryTable
        entries={[
          { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '123', iofId: 'ABC123' },
        ]}
        onEdit={handleEdit}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '編集' }));

    expect(handleEdit).toHaveBeenCalledWith('entry-1');
  });
});
