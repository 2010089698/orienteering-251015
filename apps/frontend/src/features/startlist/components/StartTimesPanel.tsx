import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { StartTimeDto } from '@startlist-management/application';
import { useStartlistApi } from '../api/useStartlistApi';
import {
  createStatus,
  setLoading,
  setStatus,
  updateSnapshot,
  updateStartTimes,
  updateVersionHistory,
  updateDiff,
  useStartlistClassAssignments,
  useStartlistClassSplitResult,
  useStartlistClassSplitRules,
  useStartlistDispatch,
  useStartlistEntries,
  useStartlistEventContext,
  useStartlistLaneAssignments,
  useStartlistLoading,
  useStartlistSettings,
  useStartlistStartTimes,
  useStartlistStartlistId,
  useStartlistStartOrderRules,
  useStartlistStatuses,
  useStartlistWorldRankingByClass,
  useStartlistLatestVersion,
  useStartlistPreviousVersion,
  useStartlistDiff,
  setEventLinkStatus,
} from '../state/StartlistContext';
import { calculateStartTimes } from '../utils/startlistUtils';
import { downloadStartlistCsv } from '../utils/startlistExport';
import { useEventManagementApi } from '../../event-management/api/useEventManagementApi';
import { tryAutoAttachStartlist } from '../utils/eventLinking';

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const datePart = date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const timePart = date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tokyo',
    timeZoneName: 'short',
  });
  return `${datePart} ${timePart}`;
};

const StartTimesPanel = (): JSX.Element => {
  const settings = useStartlistSettings();
  const entries = useStartlistEntries();
  const laneAssignments = useStartlistLaneAssignments();
  const classAssignments = useStartlistClassAssignments();
  const startTimes = useStartlistStartTimes();
  const startlistId = useStartlistStartlistId();
  const statuses = useStartlistStatuses();
  const loading = useStartlistLoading();
  const classSplitRules = useStartlistClassSplitRules();
  const classSplitResult = useStartlistClassSplitResult();
  const startOrderRules = useStartlistStartOrderRules();
  const worldRankingByClass = useStartlistWorldRankingByClass();
  const dispatch = useStartlistDispatch();
  const api = useStartlistApi();
  const latestVersion = useStartlistLatestVersion();
  const previousVersion = useStartlistPreviousVersion();
  const diff = useStartlistDiff();
  const eventContext = useStartlistEventContext();
  const { attachStartlist } = useEventManagementApi();
  const [diffError, setDiffError] = useState<string>();
  const [diffLoading, setDiffLoading] = useState(false);

  const refreshDiff = useCallback(async () => {
    if (!startlistId) {
      updateVersionHistory(dispatch, []);
      updateDiff(dispatch, undefined);
      return;
    }

    try {
      setDiffError(undefined);
      setDiffLoading(true);
      const versions = await api.fetchVersions({ startlistId, limit: 2 });
      const summaries = versions.items
        .map(({ version, confirmedAt }) => ({ version, confirmedAt }))
        .sort((a, b) => b.version - a.version);
      updateVersionHistory(dispatch, summaries);

      if (!summaries.length) {
        updateDiff(dispatch, undefined);
        return;
      }

      const [latest, previous] = summaries;
      const diffResult = await api.fetchDiff({
        startlistId,
        ...(previous ? { fromVersion: previous.version } : {}),
        toVersion: latest.version,
      });
      updateDiff(dispatch, diffResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : '差分の取得に失敗しました。';
      setDiffError(message);
      updateVersionHistory(dispatch, []);
      updateDiff(dispatch, undefined);
    } finally {
      setDiffLoading(false);
    }
  }, [api, dispatch, startlistId]);

  useEffect(() => {
    void refreshDiff();
  }, [refreshDiff]);

  const diffHighlights = useMemo(() => {
    const highlights: {
      rowClasses: Map<string, 'diff-added' | 'diff-updated'>;
      removed: StartTimeDto[];
    } = { rowClasses: new Map(), removed: [] };

    const startTimesDiff = diff?.changes?.startTimes;
    if (!startTimesDiff) {
      return highlights;
    }

    const previousList = startTimesDiff.previous ?? [];
    const previousByPlayer = new Map(previousList.map((item) => [item.playerId, item]));
    const currentList = startTimesDiff.current ?? startTimes;
    const currentIds = new Set(currentList.map((item) => item.playerId));

    for (const time of startTimes) {
      const prev = previousByPlayer.get(time.playerId);
      if (!prev) {
        highlights.rowClasses.set(time.playerId, 'diff-added');
        continue;
      }
      if (prev.laneNumber !== time.laneNumber || prev.startTime !== time.startTime) {
        highlights.rowClasses.set(time.playerId, 'diff-updated');
      }
    }

    for (const prev of previousList) {
      if (!currentIds.has(prev.playerId)) {
        highlights.removed.push(prev);
      }
    }

    return highlights;
  }, [diff, startTimes]);

  const showDiffLegend = diffHighlights.rowClasses.size > 0 || diffHighlights.removed.length > 0;

  const versionInfoText = useMemo(() => {
    if (diffLoading) {
      return '差分を読み込み中…';
    }
    if (!latestVersion) {
      return 'バージョン履歴がまだありません。';
    }
    const latestText = `最新 v${latestVersion.version} (${formatDateTime(latestVersion.confirmedAt)})`;
    const previousText = previousVersion
      ? ` / 前回 v${previousVersion.version} (${formatDateTime(previousVersion.confirmedAt)})`
      : '';
    return `比較対象: ${latestText}${previousText}`;
  }, [diffLoading, latestVersion, previousVersion]);

  const ready = Boolean(settings && laneAssignments.length > 0 && classAssignments.length > 0);

  const handleRecalculate = () => {
    if (!settings) {
      setStatus(dispatch, 'startTimes', createStatus('先に基本情報を設定してください。', 'error'));
      return;
    }
    const computed = calculateStartTimes({
      settings,
      laneAssignments,
      classAssignments,
      entries,
      splitRules: classSplitRules,
      splitResult: classSplitResult,
      startOrderRules,
      worldRankingByClass,
    });
    updateStartTimes(dispatch, computed, classSplitResult);
    if (computed.length === 0) {
      setStatus(dispatch, 'startTimes', createStatus('必要なデータが不足しています。', 'error'));
    } else {
      setStatus(dispatch, 'startTimes', createStatus(`${computed.length} 件のスタート時間を算出しました。`, 'success'));
    }
  };

  const handlePersist = async () => {
    if (!startlistId) {
      setStatus(dispatch, 'startTimes', createStatus('スタートリスト ID を設定してください。', 'error'));
      return;
    }
    if (startTimes.length === 0) {
      setStatus(dispatch, 'startTimes', createStatus('まずスタート時間を再計算してください。', 'error'));
      return;
    }
    try {
      setLoading(dispatch, 'startTimes', true);
      const snapshot = await api.assignStartTimes({ startlistId, startTimes });
      updateSnapshot(dispatch, snapshot);
      setStatus(dispatch, 'startTimes', createStatus('スタート時間を送信しました。', 'success'));
      if (snapshot) {
        setStatus(dispatch, 'snapshot', createStatus('スナップショットを更新しました。', 'info'));
      }
      await refreshDiff();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'スタート時間の送信に失敗しました。';
      setStatus(dispatch, 'startTimes', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'startTimes', false);
    }
  };

  const handleExportCsv = () => {
    if (startTimes.length === 0) {
      return;
    }

    setLoading(dispatch, 'startTimes', true);

    try {
      const count = downloadStartlistCsv({ entries, startTimes, classAssignments });
      setStatus(
        dispatch,
        'startTimes',
        createStatus(`${count} 件のスタート時間をエクスポートしました。`, 'info'),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV のエクスポートに失敗しました。';
      setStatus(dispatch, 'startTimes', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'startTimes', false);
    }
  };

  const handleFinalize = async () => {
    if (!startlistId) {
      setStatus(dispatch, 'startTimes', createStatus('スタートリスト ID を設定してください。', 'error'));
      return;
    }
    try {
      setLoading(dispatch, 'startTimes', true);
      const snapshot = await api.finalize({ startlistId });
      updateSnapshot(dispatch, snapshot);
      setStatus(dispatch, 'startTimes', createStatus('スタートリストを確定しました。', 'success'));
      setStatus(dispatch, 'snapshot', createStatus('スタートリストを確定しました。', 'success'));

      if (eventContext.eventId && eventContext.raceId) {
        try {
          const versions = await api.fetchVersions({ startlistId, limit: 1 });
          const latest = versions.items
            .slice()
            .sort((a, b) => b.version - a.version)[0];
          if (latest) {
            await tryAutoAttachStartlist({
              dispatch,
              eventContext,
              attachStartlist,
              startlistId: snapshot?.id ?? startlistId,
              version: latest.version,
              confirmedAt: latest.confirmedAt,
            });
          } else {
            const message = 'スタートリストの最新バージョンが取得できませんでした。';
            setEventLinkStatus(dispatch, {
              status: 'error',
              eventId: eventContext.eventId,
              raceId: eventContext.raceId,
              errorMessage: message,
            });
            setStatus(dispatch, 'snapshot', createStatus(message, 'error'));
          }
        } catch (versionError) {
          const message =
            versionError instanceof Error
              ? versionError.message
              : 'スタートリストのバージョン取得に失敗しました。';
          setEventLinkStatus(dispatch, {
            status: 'error',
            eventId: eventContext.eventId,
            raceId: eventContext.raceId,
            errorMessage: message,
          });
          setStatus(dispatch, 'snapshot', createStatus(message, 'error'));
        }
      }
      await refreshDiff();
    } catch (error) {
      const message = error instanceof Error ? error.message : '確定処理に失敗しました。';
      setStatus(dispatch, 'startTimes', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'startTimes', false);
    }
  };

  const handleInvalidate = async () => {
    if (!startlistId) {
      setStatus(dispatch, 'startTimes', createStatus('スタートリスト ID を設定してください。', 'error'));
      return;
    }
    const reason = window.prompt('スタート時間を無効化する理由を入力してください。', '調整が必要なため');
    if (!reason) {
      return;
    }
    try {
      setLoading(dispatch, 'startTimes', true);
      const snapshot = await api.invalidateStartTimes({ startlistId, reason });
      updateSnapshot(dispatch, snapshot);
      updateStartTimes(dispatch, [], classSplitResult);
      setStatus(dispatch, 'startTimes', createStatus('スタート時間を無効化しました。', 'info'));
      if (snapshot) {
        setStatus(dispatch, 'snapshot', createStatus('スナップショットを更新しました。', 'info'));
      }
      await refreshDiff();
    } catch (error) {
      const message = error instanceof Error ? error.message : '無効化処理に失敗しました。';
      setStatus(dispatch, 'startTimes', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'startTimes', false);
    }
  };

  return (
    <section aria-labelledby="start-times-heading">
      <header>
        <h2 id="start-times-heading">スタート時間の算出と確定</h2>
        <p className="muted">レーン割り当てとクラス順序に基づいてスタート時間を計算します。ここで表示される時刻はすべて日本時間 (JST) です。</p>
      </header>
      <div className="actions-row">
        <button type="button" onClick={handleRecalculate} disabled={!ready}>
          スタート時間を再計算
        </button>
        <button type="button" className="secondary" onClick={handlePersist} disabled={loading.startTimes}>
          API に送信
        </button>
        <button
          type="button"
          className="secondary"
          onClick={handleExportCsv}
          disabled={startTimes.length === 0 || Boolean(loading.startTimes)}
        >
          CSV をエクスポート
        </button>
        <button type="button" className="secondary" onClick={handleFinalize} disabled={loading.startTimes}>
          スタートリストを確定
        </button>
        <button type="button" className="secondary" onClick={handleInvalidate} disabled={loading.startTimes}>
          スタート時間を無効化
        </button>
        <span className="muted">{startTimes.length} 件のスタート時間</span>
      </div>
      <div className="start-times__diff-meta">
        <p className="muted" aria-live="polite">{versionInfoText}</p>
        {showDiffLegend ? (
          <div className="diff-legend" role="note" aria-label="差分ハイライトの凡例">
            <span className="diff-legend__item">
              <span className="diff-swatch diff-swatch--added" aria-hidden="true" />
              <span>追加</span>
            </span>
            <span className="diff-legend__item">
              <span className="diff-swatch diff-swatch--updated" aria-hidden="true" />
              <span>更新</span>
            </span>
            <span className="diff-legend__item">
              <span className="diff-swatch diff-swatch--removed" aria-hidden="true" />
              <span>削除</span>
            </span>
          </div>
        ) : null}
        {diffError ? (
          <p className="diff-error" role="status">
            {diffError}
          </p>
        ) : null}
      </div>
      {startTimes.length === 0 && diffHighlights.removed.length === 0 ? (
        <p className="muted">まだスタート時間が計算されていません。</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>カード番号</th>
                <th>レーン</th>
                <th>スタート時刻</th>
              </tr>
            </thead>
            <tbody>
              {startTimes.map((time) => {
                const isoValue =
                  typeof time.startTime === 'string' ? time.startTime : new Date(time.startTime).toISOString();
                const diffClass = diffHighlights.rowClasses.get(time.playerId);
                const annotation = diffClass === 'diff-added' ? '追加' : diffClass === 'diff-updated' ? '更新' : undefined;
                return (
                  <tr key={`${time.playerId}-${time.laneNumber}`} className={diffClass} data-diff={diffClass}>
                    <td>
                      {time.playerId}
                      {annotation ? <span className="diff-annotation">{annotation}</span> : null}
                    </td>
                    <td>{time.laneNumber}</td>
                    <td>{formatDateTime(isoValue)}</td>
                  </tr>
                );
              })}
              {diffHighlights.removed.map((removed) => (
                <tr key={`removed-${removed.playerId}-${removed.laneNumber}`} className="diff-removed" data-diff="diff-removed">
                  <td>
                    {removed.playerId}
                    <span className="diff-annotation">削除</span>
                  </td>
                  <td>{removed.laneNumber}</td>
                  <td>{formatDateTime(removed.startTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <StatusMessage tone={statuses.startTimes.level} message={statuses.startTimes.text} />
    </section>
  );
};

export default StartTimesPanel;
