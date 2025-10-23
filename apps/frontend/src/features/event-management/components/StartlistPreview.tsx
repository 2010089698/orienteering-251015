import { useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { StartlistWithHistoryDto } from '@startlist-management/application';

import { useStartlistApi } from '../../startlist/api/useStartlistApi';

type StartlistStatus = StartlistWithHistoryDto['status'];

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
});

const statusLabelMap: Record<StartlistStatus, string> = {
  DRAFT: '下書き',
  SETTINGS_ENTERED: '設定入力済み',
  LANE_ORDER_ASSIGNED: 'レーン確定済み',
  PLAYER_ORDER_ASSIGNED: 'クラス順確定',
  START_TIMES_ASSIGNED: 'スタート時刻確定',
  FINALIZED: '公開済み',
};

interface StartlistPreviewProps {
  startlistId: string;
  version?: number;
  updatedAt?: string;
}

const PREVIEW_LIMIT = 5;

const defaultErrorMessage = 'スタートリストの取得に失敗しました。';

const formatDateTime = (value?: string): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return dateTimeFormatter.format(parsed);
};

const StartlistPreview = ({ startlistId, version, updatedAt }: StartlistPreviewProps) => {
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
        const latest = await fetchSnapshot({ startlistId });
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
  }, [fetchSnapshot, startlistId, version]);

  const previewStartTimes = useMemo(() => {
    if (!snapshot?.startTimes.length) {
      return [] as StartlistWithHistoryDto['startTimes'];
    }
    return [...snapshot.startTimes]
      .sort((left, right) => {
        const leftTime = new Date(left.startTime).getTime();
        const rightTime = new Date(right.startTime).getTime();
        return leftTime - rightTime;
      })
      .slice(0, PREVIEW_LIMIT);
  }, [snapshot]);

  const totalStartTimes = snapshot?.startTimes.length ?? 0;
  const remainingCount = Math.max(0, totalStartTimes - previewStartTimes.length);

  const formattedUpdatedAt = formatDateTime(updatedAt);
  const formattedStartTime = formatDateTime(snapshot?.settings?.startTime);
  const laneCount = snapshot?.settings?.laneCount;
  const statusLabel = snapshot ? statusLabelMap[snapshot.status] ?? snapshot.status : undefined;

  return (
    <section className="startlist-preview" aria-label={`スタートリスト ${startlistId} のプレビュー`}>
      <header className="startlist-preview__meta">
        <span className="startlist-preview__meta-item startlist-preview__meta-item--id">ID: {startlistId}</span>
        {statusLabel ? (
          <span className="startlist-preview__meta-item startlist-preview__meta-item--status">状態: {statusLabel}</span>
        ) : null}
        {typeof version === 'number' ? (
          <span className="startlist-preview__meta-item startlist-preview__meta-item--version">公開バージョン v{version}</span>
        ) : null}
        {formattedUpdatedAt ? (
          <span className="startlist-preview__meta-item startlist-preview__meta-item--updated">
            更新: <time dateTime={updatedAt}>{formattedUpdatedAt}</time>
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
          <table className="startlist-preview__table" aria-label="スタートリストのプレビュー">
            <thead>
              <tr>
                <th scope="col">順番</th>
                <th scope="col">選手ID</th>
                <th scope="col">レーン</th>
                <th scope="col">スタート</th>
              </tr>
            </thead>
            <tbody>
              {previewStartTimes.map((startTime, index) => {
                const displayOrder = index + 1;
                const parsedStartTime = new Date(startTime.startTime);
                const formattedTime = Number.isNaN(parsedStartTime.getTime())
                  ? ''
                  : timeFormatter.format(parsedStartTime);
                return (
                  <tr key={`${startTime.playerId}-${startTime.startTime}-${index}`}>
                    <th scope="row">{displayOrder}</th>
                    <td>{startTime.playerId}</td>
                    <td>{startTime.laneNumber}</td>
                    <td>
                      {formattedTime ? (
                        <time dateTime={startTime.startTime}>{formattedTime}</time>
                      ) : (
                        <span aria-label="未定">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
