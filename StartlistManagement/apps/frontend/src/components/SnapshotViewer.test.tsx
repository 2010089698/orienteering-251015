import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SnapshotViewer from './SnapshotViewer';

describe('SnapshotViewer', () => {
  it('shows hint when no snapshot provided', () => {
    render(<SnapshotViewer status={{ level: 'idle', text: '待機中です。' }} onRefreshHint />);

    expect(screen.getByText('まだスナップショットが取得されていません。')).toBeInTheDocument();
    expect(screen.getByText('待機中です。')).toBeInTheDocument();
  });

  it('renders snapshot json when available', () => {
    const snapshot = { foo: 'bar' };
    render(<SnapshotViewer snapshot={snapshot} status={{ level: 'info', text: '更新しました' }} />);

    expect(screen.getByText('更新しました')).toBeInTheDocument();
    expect(screen.getByText(/"foo": "bar"/)).toBeInTheDocument();
  });
});
