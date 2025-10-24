import { useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { StartlistWithHistoryDto } from '@startlist-management/application';

import { useStartlistApi } from '../../startlist/api/useStartlistApi';
import StartTimesTable from '../../startlist/components/StartTimesTable';
import { formatDateTime, sortStartTimes } from '../../startlist/utils/startlistFormatting';
import { getStartlistStatusLabel } from '../utils/startlistStatus';

interface StartlistPreviewProps {
  startlistId: string;
  initialStatus?: string;
}

const PREVIEW_LIMIT = 5;

const defaultErrorMessage = 'スタートリストの取得に失敗しました。';

const StartlistPreview = ({ startlistId, initialStatus }: StartlistPreviewProps) => {
  const { fetchSnapshot } = useStartlistApi();
  const [snapshot, setSnapshot] = useState<StartlistWithHistoryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const latest = await fetchSnapshot({ startlistId, includeVersions: true, versionLimit: 1 });
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

  const previewStartTimes = useMemo(() => {
    if (!snapshot?.startTimes.length) {
      return [] as StartlistWithHistoryDto['startTimes'];
    }
    return sortStartTimes(snapshot.startTimes).slice(0, PREVIEW_LIMIT);
  }, [snapshot]);

  const totalStartTimes = snapshot?.startTimes.length ?? 0;
  const remainingCount = Math.max(0, totalStartTimes - previewStartTimes.length);

  const formattedStartTime = formatDateTime(snapshot?.settings?.startTime);
  const laneCount = snapshot?.settings?.laneCount;
  const statusLabel = getStartlistStatusLabel(snapshot?.status ?? initialStatus ?? undefined);
  const latestVersion = snapshot?.versions?.slice().sort((a, b) => b.version - a.version)[0];
  const formattedUpdatedAt = formatDateTime(latestVersion?.confirmedAt);

  return (
    <section className="startlist-preview" aria-label={`スタートリスト ${startlistId} のプレビュー`}>
      <header className="startlist-preview__meta">
        <span className="startlist-preview__meta-item startlist-preview__meta-item--id">ID: {startlistId}</span>
        {statusLabel ? (
          <span className="startlist-preview__meta-item startlist-preview__meta-item--status">状態: {statusLabel}</span>
        ) : null}
        {typeof latestVersion?.version === 'number' ? (
          <span className="startlist-preview__meta-item startlist-preview__meta-item--version">
            公開バージョン v{latestVersion.version}
          </span>
        ) : null}
        {formattedUpdatedAt ? (
          <span className="startlist-preview__meta-item startlist-preview__meta-item--updated">
            更新: <time dateTime={latestVersion?.confirmedAt}>{formattedUpdatedAt}</time>
          </span>
        ) : null}
      </header>
      {formattedStartTime || laneCount || totalStartTimes ? (
        <p className="startlist-preview__summary">
          {formattedStartTime ? (
            <span>
              開始: <time dateTime={snapshot?.settings?.startTime}>{formattedStartTime}</time>
            </span>
          ) : null}
          {laneCount ? <span>レーン数: {laneCount}</span> : null}
          {totalStartTimes ? <span>確定スタート数: {totalStartTimes}</span> : null}
        </p>
      ) : null}
      {isLoading ? (
        <p className="startlist-preview__loading">スタートリストを読み込み中…</p>
      ) : error ? (
        <StatusMessage tone="error" message={error} />
      ) : previewStartTimes.length ? (
        <>
          <StartTimesTable
            startTimes={previewStartTimes}
            className="startlist-preview__table"
            ariaLabel="スタートリストのプレビュー"
          />
          {remainingCount > 0 ? (
            <p className="startlist-preview__more">ほか {remainingCount} 件のスタートがあります。</p>
          ) : null}
        </>
      ) : (
        <p className="startlist-preview__empty">確定したスタート時刻はまだありません。</p>
      )}
    </section>
  );
};

export default StartlistPreview;
