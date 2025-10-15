import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StepNavigation from './StepNavigation';
import type { StatusMessageState } from '../state/types';

const steps = [
  { id: 'settings', title: '基本情報', description: 'desc' },
  { id: 'entries', title: 'エントリー', description: 'desc' },
];

const buildStatuses = (overrides: Partial<Record<string, StatusMessageState>> = {}) => ({
  settings: { level: 'success', text: '保存済み' },
  entries: { level: 'error', text: 'エラーがあります' },
  lanes: { level: 'idle', text: '待機中です。' },
  classes: { level: 'idle', text: '待機中です。' },
  startTimes: { level: 'idle', text: '待機中です。' },
  snapshot: { level: 'idle', text: '待機中です。' },
  ...overrides,
});

describe('StepNavigation', () => {
  it('renders tone labels based on status levels', () => {
    const statuses = buildStatuses();
    render(<StepNavigation steps={steps} statuses={statuses} />);

    expect(screen.getByText('完了')).toBeInTheDocument();
    expect(screen.getByText('保存済み')).toBeInTheDocument();
    expect(screen.getByText('要確認')).toBeInTheDocument();
    expect(screen.getByText('エラーがあります')).toBeInTheDocument();
  });
});
