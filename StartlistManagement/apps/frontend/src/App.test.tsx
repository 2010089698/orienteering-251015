import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { renderWithStartlist } from './test/test-utils';

describe('App', () => {
  it('renders all major panels', () => {
    renderWithStartlist(<App />);

    expect(screen.getByRole('heading', { name: 'スタートリスト・ウィザード' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'スタートリスト基本情報' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'エントリー入力' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'レーン割り当て' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'クラス内順序' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'スタート時間の算出と確定' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'スナップショット' })).toBeInTheDocument();
  });
});
