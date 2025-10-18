import { StatusMessage } from '@orienteering/shared-ui';
import { useStartlistApi } from '../api/useStartlistApi';
import {
  createStatus,
  setLoading,
  setStatus,
  updateSnapshot,
  updateStartTimes,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import { calculateStartTimes } from '../utils/startlistUtils';
import { downloadStartlistCsv } from '../utils/startlistExport';

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
  const { settings, entries, laneAssignments, classAssignments, startTimes, startlistId, statuses, loading } = useStartlistState();
  const dispatch = useStartlistDispatch();
  const api = useStartlistApi();

  const ready = Boolean(settings && laneAssignments.length > 0 && classAssignments.length > 0);

  const handleRecalculate = () => {
    if (!settings) {
      setStatus(dispatch, 'startTimes', createStatus('先に基本情報を設定してください。', 'error'));
      return;
    }
    const computed = calculateStartTimes({ settings, laneAssignments, classAssignments, entries });
    updateStartTimes(dispatch, computed);
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
      if (snapshot) {
        setStatus(dispatch, 'snapshot', createStatus('スナップショットを更新しました。', 'info'));
      }
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
      updateStartTimes(dispatch, []);
      setStatus(dispatch, 'startTimes', createStatus('スタート時間を無効化しました。', 'info'));
      if (snapshot) {
        setStatus(dispatch, 'snapshot', createStatus('スナップショットを更新しました。', 'info'));
      }
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
      {startTimes.length === 0 ? (
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
                return (
                  <tr key={`${time.playerId}-${time.laneNumber}`}>
                    <td>{time.playerId}</td>
                    <td>{time.laneNumber}</td>
                    <td>{formatDateTime(isoValue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <StatusMessage tone={statuses.startTimes.level} message={statuses.startTimes.text} />
    </section>
  );
};

export default StartTimesPanel;
