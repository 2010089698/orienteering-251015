import { StatusMessage } from '@startlist-management/ui-components';
import type { StatusMessageState } from '../state/types';

interface SnapshotViewerProps {
  snapshot?: unknown;
  status: StatusMessageState;
  onRefreshHint?: boolean;
}

const SnapshotViewer = ({ snapshot, status, onRefreshHint }: SnapshotViewerProps): JSX.Element => {
  return (
    <section aria-labelledby="snapshot-heading">
      <header>
        <h2 id="snapshot-heading">スナップショット</h2>
        <p className="muted">
          バックエンドから取得した最新状態を表示します。
          {onRefreshHint && ' 基本情報パネルから最新状態を取得できます。'}
        </p>
      </header>
      {snapshot ? (
        <pre className="snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
      ) : (
        <p className="muted">まだスナップショットが取得されていません。</p>
      )}
      <StatusMessage tone={status.level} message={status.text} />
    </section>
  );
};

export default SnapshotViewer;
