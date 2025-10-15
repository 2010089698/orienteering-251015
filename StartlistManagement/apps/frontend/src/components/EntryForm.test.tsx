import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import EntryForm from './EntryForm';
import { renderWithStartlist } from '../test/test-utils';

describe('EntryForm', () => {
  it('validates required fields', async () => {
    renderWithStartlist(<EntryForm />);

    await userEvent.type(screen.getByLabelText('クラス ID'), ' ');
    await userEvent.type(screen.getByLabelText('カード番号'), ' ');
    await userEvent.click(screen.getByRole('button', { name: 'エントリー追加' }));

    expect(await screen.findByText('クラス ID とカード番号は必須です。')).toBeInTheDocument();
  });

  it('prevents duplicate card numbers', async () => {
    renderWithStartlist(<EntryForm />, {
      initialState: {
        entries: [{ name: 'A', classId: 'M21', cardNo: '123' }],
      },
    });

    await userEvent.type(screen.getByLabelText('クラス ID'), 'M21');
    await userEvent.type(screen.getByLabelText('カード番号'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'エントリー追加' }));

    expect(await screen.findByText('同じカード番号のエントリーが既に存在します。')).toBeInTheDocument();
  });

  it('appends entry and resets form when submission succeeds', async () => {
    renderWithStartlist(<EntryForm />);

    await userEvent.type(screen.getByLabelText('選手名'), '山田 太郎');
    await userEvent.type(screen.getByLabelText('クラス ID'), 'M21E');
    await userEvent.type(screen.getByLabelText('カード番号'), '555');
    await userEvent.click(screen.getByRole('button', { name: 'エントリー追加' }));

    expect(await screen.findByText('1 件のエントリーがあります。')).toBeInTheDocument();
    expect(screen.getByLabelText('選手名')).toHaveValue('');
    expect(screen.getByLabelText('カード番号')).toHaveValue('');
  });
});
