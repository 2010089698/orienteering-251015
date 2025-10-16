import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('navigates between registered business capabilities', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'スタートリスト作成ガイド' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'エントリー管理' }));

    expect(await screen.findByRole('heading', { name: 'エントリー管理 (準備中)' })).toBeInTheDocument();
  });
});
