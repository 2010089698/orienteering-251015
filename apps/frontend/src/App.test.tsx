import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { renderWithStartlist } from './test/test-utils';

describe('App', () => {
  it('guides the user through the three steps', async () => {
    renderWithStartlist(<App />);

    expect(screen.getByRole('heading', { name: 'スタートリスト作成ガイド' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'STEP 1 入力内容の整理' })).toBeInTheDocument();

    // move to step 2 without data should show validation message
    await userEvent.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));
    expect(await screen.findByText('基本情報を保存してから進んでください。')).toBeInTheDocument();
  });
});
