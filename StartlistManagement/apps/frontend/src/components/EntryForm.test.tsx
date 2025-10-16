import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import EntryForm from './EntryForm';
import { renderWithStartlist } from '../test/test-utils';

describe('EntryForm', () => {
  it('validates required fields', async () => {
    renderWithStartlist(<EntryForm />);

    await userEvent.type(screen.getByLabelText('クラス'), ' ');
    await userEvent.type(screen.getByLabelText('カード番号'), ' ');
    await userEvent.click(screen.getByRole('button', { name: '参加者を追加' }));

    expect(await screen.findByText('クラスとカード番号を入力してください。')).toBeInTheDocument();
  });

  it('prevents duplicate card numbers', async () => {
    renderWithStartlist(<EntryForm />, {
      initialState: {
        entries: [{ name: 'A', classId: 'M21', cardNo: '123' }],
      },
    });

    await userEvent.type(screen.getByLabelText('クラス'), 'M21');
    await userEvent.type(screen.getByLabelText('カード番号'), '123');
    await userEvent.click(screen.getByRole('button', { name: '参加者を追加' }));

    expect(await screen.findByText('同じカード番号の参加者が登録されています。')).toBeInTheDocument();
  });

  it('appends entry and resets form when submission succeeds', async () => {
    renderWithStartlist(<EntryForm />);

    await userEvent.type(screen.getByLabelText('選手名'), '山田 太郎');
    await userEvent.type(screen.getByLabelText('クラス'), 'M21E');
    await userEvent.type(screen.getByLabelText('カード番号'), '555');
    await userEvent.click(screen.getByRole('button', { name: '参加者を追加' }));

    expect(await screen.findByText('1 人の参加者を登録しました。')).toBeInTheDocument();
    expect(screen.getByLabelText('選手名')).toHaveValue('');
    expect(screen.getByLabelText('カード番号')).toHaveValue('');
  });
});
