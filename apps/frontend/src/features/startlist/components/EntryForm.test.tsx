import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import EntryForm from './EntryForm';
import { renderWithStartlist } from '../test/test-utils';

describe('EntryForm', () => {
  it('validates required fields', async () => {
    const user = userEvent.setup();
    renderWithStartlist(<EntryForm />);

    await user.type(screen.getByLabelText('クラス'), ' ');
    await user.type(screen.getByLabelText('カード番号'), ' ');
    await user.click(screen.getByRole('button', { name: '参加者を追加' }));

    expect(await screen.findByText('クラスとカード番号を入力してください。')).toBeInTheDocument();
  });

  it('prevents duplicate card numbers', async () => {
    const user = userEvent.setup();
    renderWithStartlist(<EntryForm />, {
      initialState: {
        entries: [{ name: 'A', classId: 'M21', cardNo: '123' }],
      },
    });

    await user.type(screen.getByLabelText('クラス'), 'M21');
    await user.type(screen.getByLabelText('カード番号'), '123');
    await user.click(screen.getByRole('button', { name: '参加者を追加' }));

    expect(await screen.findByText('同じカード番号の参加者が登録されています。')).toBeInTheDocument();
  });

  it('appends entry and resets form when submission succeeds', async () => {
    const user = userEvent.setup();
    renderWithStartlist(<EntryForm />);

    await user.type(screen.getByLabelText('選手名'), '山田 太郎');
    await user.type(screen.getByLabelText('クラス'), 'M21E');
    await user.type(screen.getByLabelText('カード番号'), '555');
    await user.click(screen.getByRole('button', { name: '参加者を追加' }));

    expect(await screen.findByText('1 人の参加者を登録しました。')).toBeInTheDocument();
    expect(screen.getByLabelText('選手名')).toHaveValue('');
    expect(screen.getByLabelText('カード番号')).toHaveValue('');
  });

  it('imports entries from CSV upload', async () => {
    const user = userEvent.setup();
    renderWithStartlist(<EntryForm />);

    const file = new File(
      ['name,club,class,card number\nAlice,Tokyo,M21,123\nBob,,F21,456\n'],
      'entries.csv',
      { type: 'text/csv' },
    );

    await user.upload(screen.getByLabelText('CSV から参加者を一括登録'), file);

    expect(await screen.findByText('CSV から 2 人の参加者を追加しました。')).toBeInTheDocument();
  });

  it('reports duplicates when CSV contains existing card numbers', async () => {
    const user = userEvent.setup();
    renderWithStartlist(<EntryForm />, {
      initialState: {
        entries: [{ name: '登録済み', classId: 'M21', cardNo: '123' }],
      },
    });

    const file = new File(['name,class,card number\nAlice,M21,123\n'], 'entries.csv', {
      type: 'text/csv',
    });

    await user.upload(screen.getByLabelText('CSV から参加者を一括登録'), file);

    expect(await screen.findByText('カード番号 123 はすでに登録されています。')).toBeInTheDocument();
  });
});
