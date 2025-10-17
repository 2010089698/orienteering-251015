import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import EntryTable from './EntryTable';
import { renderWithStartlist } from '../test/test-utils';

describe('EntryTable', () => {
  it('shows empty state when no entries exist', () => {
    renderWithStartlist(<EntryTable />);

    expect(screen.getByText('登録済みの参加者はまだいません。')).toBeInTheDocument();
  });

  it('removes entry and updates status when delete is pressed', async () => {
    renderWithStartlist(<EntryTable />, {
      initialState: {
        entries: [
          { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '123' },
          { id: 'entry-2', name: 'B', classId: 'W21', cardNo: '456' },
        ],
      },
    });

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2 entries

    const secondRow = rows[2];
    await userEvent.click(within(secondRow).getByRole('button', { name: '削除' }));

    expect(screen.getAllByRole('row')).toHaveLength(2);
  });
});
