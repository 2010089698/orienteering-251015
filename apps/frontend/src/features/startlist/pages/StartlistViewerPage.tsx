import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StatusMessage } from '@orienteering/shared-ui';
import type { StartlistWithHistoryDto } from '@startlist-management/application';

import { useStartlistApi } from '../api/useStartlistApi';
import StartTimesTable from '../components/StartTimesTable';
import { formatDateTime, sortStartTimes } from '../utils/startlistFormatting';
import { getStartlistStatusLabel } from '../../event-management/utils/startlistStatus';

const defaultErrorMessage = 'スタートリストの取得に失敗しました。';

const StartlistViewerPage = () => {
  const { startlistId = '' } = useParams<{ startlistId: string }>();
  const { fetchSnapshot } = useStartlistApi();
  const [snapshot, setSnapshot] = useState<StartlistWithHistoryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!startlistId) {
      setSnapshot(null);
      setIsLoading(false);
      setError('スタートリストIDが指定されていません。');
      return () => {
        cancelled = true;
      };
    }

    const loadSnapshot = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const latest = await fetchSnapshot({ startlistId, includeVersions: true });
        if (cancelled) {
          return;
        }
        setSnapshot(latest);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setSnapshot(null);
        setError(err instanceof Error ? err.message : defaultErrorMessage);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [fetchSnapshot, startlistId]);

  const sortedStartTimes = useMemo(() => {
    if (!snapshot?.startTimes.length) {
      return [] as StartlistWithHistoryDto['startTimes'];
    }
    return sortStartTimes(snapshot.startTimes);
  }, [snapshot]);

  const latestVersion = useMemo(() => {
    if (!snapshot?.versions?.length) {
      return undefined;
    }
    return [...snapshot.versions].sort((a, b) => b.version - a.version)[0];
  }, [snapshot]);

  const statusLabel = getStartlistStatusLabel(snapshot?.status);
  const confirmedAt = formatDateTime(latestVersion?.confirmedAt);

  return (
    <div className="startlist-viewer" aria-live="polite">
      <header className="startlist-viewer__header">
        <h1 className="startlist-viewer__title">スタートリストビューアー</h1>
        <dl className="startlist-viewer__meta">
          <div className="startlist-viewer__meta-item">
            <dt>ID</dt>
            <dd>{startlistId}</dd>
          </div>
          {statusLabel ? (
            <div className="startlist-viewer__meta-item">
              <dt>状態</dt>
              <dd>{statusLabel}</dd>
            </div>
          ) : null}
          {snapshot?.eventId ? (
            <div className="startlist-viewer__meta-item">
              <dt>イベントID</dt>
              <dd>{snapshot.eventId}</dd>
            </div>
          ) : null}
          {snapshot?.raceId ? (
            <div className="startlist-viewer__meta-item">
              <dt>レースID</dt>
              <dd>{snapshot.raceId}</dd>
            </div>
          ) : null}
          {typeof latestVersion?.version === 'number' ? (
            <div className="startlist-viewer__meta-item">
              <dt>公開バージョン</dt>
              <dd>v{latestVersion.version}</dd>
            </div>
          ) : null}
          {confirmedAt && latestVersion?.confirmedAt ? (
            <div className="startlist-viewer__meta-item">
              <dt>確定日時</dt>
              <dd>
                <time dateTime={latestVersion.confirmedAt}>{confirmedAt}</time>
              </dd>
            </div>
          ) : null}
          {snapshot?.settings?.startTime ? (
            <div className="startlist-viewer__meta-item">
              <dt>開始予定</dt>
              <dd>
                <time dateTime={snapshot.settings.startTime}>
                  {formatDateTime(snapshot.settings.startTime)}
                </time>
              </dd>
            </div>
          ) : null}
        </dl>
      </header>

      {isLoading ? (
        <p className="startlist-viewer__loading">スタートリストを読み込み中…</p>
      ) : error ? (
        <StatusMessage tone="error" message={error} />
      ) : snapshot ? (
        <section className="startlist-viewer__content">
          {sortedStartTimes.length ? (
            <StartTimesTable
              startTimes={sortedStartTimes}
              className="startlist-viewer__table"
              ariaLabel="スタート順一覧"
            />
          ) : (
            <p className="startlist-viewer__empty">確定したスタート時刻はまだありません。</p>
          )}
        </section>
      ) : null}
    </div>
  );
};

export default StartlistViewerPage;
