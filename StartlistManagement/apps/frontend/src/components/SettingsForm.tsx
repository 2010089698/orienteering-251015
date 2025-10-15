import { useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '@startlist-management/ui-components';
import type { EnterStartlistSettingsCommand, StartlistSettingsDto } from '@startlist-management/application';
import { useStartlistApi } from '../hooks/useStartlistApi';
import {
  createStatus,
  setLoading,
  setStatus,
  updateSettings,
  updateSnapshot,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';

const toIsoLocal = (value?: Date | string): string => {
  if (!value) {
    return '';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 16);
};

const extractInterval = (interval?: StartlistSettingsDto['interval']) => {
  const milliseconds = interval?.milliseconds ?? 0;
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return { minutes, seconds };
};

const SettingsForm = (): JSX.Element => {
  const { settings, startlistId, statuses, loading } = useStartlistState();
  const dispatch = useStartlistDispatch();
  const api = useStartlistApi();

  const [startlistIdInput, setStartlistIdInput] = useState(startlistId);
  const [eventId, setEventId] = useState(settings?.eventId ?? '');
  const [startTime, setStartTime] = useState(() => toIsoLocal(settings?.startTime));
  const initialInterval = useMemo(() => extractInterval(settings?.interval), [settings]);
  const [intervalMinutes, setIntervalMinutes] = useState(initialInterval.minutes);
  const [intervalSeconds, setIntervalSeconds] = useState(initialInterval.seconds);
  const [laneCount, setLaneCount] = useState(settings?.laneCount ?? 1);

  useEffect(() => {
    setStartlistIdInput(startlistId);
  }, [startlistId]);

  useEffect(() => {
    setEventId(settings?.eventId ?? '');
    setStartTime(toIsoLocal(settings?.startTime));
    const nextInterval = extractInterval(settings?.interval);
    setIntervalMinutes(nextInterval.minutes);
    setIntervalSeconds(nextInterval.seconds);
    setLaneCount(settings?.laneCount ?? 1);
  }, [settings]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!startlistIdInput.trim()) {
      setStatus(dispatch, 'settings', createStatus('スタートリスト ID を入力してください。', 'error'));
      return;
    }
    if (!startTime) {
      setStatus(dispatch, 'settings', createStatus('開始時刻を入力してください。', 'error'));
      return;
    }

    const intervalMs = (Number(intervalMinutes) * 60 + Number(intervalSeconds)) * 1000;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      setStatus(dispatch, 'settings', createStatus('スタート間隔は 1 秒以上で設定してください。', 'error'));
      return;
    }

    if (!Number.isInteger(laneCount) || laneCount <= 0) {
      setStatus(dispatch, 'settings', createStatus('レーン数は 1 以上の整数で入力してください。', 'error'));
      return;
    }

    const command: EnterStartlistSettingsCommand = {
      startlistId: startlistIdInput.trim(),
      settings: {
        eventId: eventId.trim(),
        startTime: new Date(startTime).toISOString(),
        interval: { milliseconds: intervalMs },
        laneCount: laneCount,
      },
    };

    try {
      setLoading(dispatch, 'settings', true);
      const snapshot = await api.enterSettings(command);
      updateSettings(dispatch, { startlistId: command.startlistId, settings: command.settings, snapshot });
      updateSnapshot(dispatch, snapshot);
      setStatus(dispatch, 'settings', createStatus('基本情報を保存しました。', 'success'));
      if (snapshot) {
        setStatus(dispatch, 'snapshot', createStatus('最新スナップショットを取得しました。', 'info'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '設定の送信に失敗しました。';
      setStatus(dispatch, 'settings', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'settings', false);
    }
  };

  const handleRefreshSnapshot = async () => {
    if (!startlistIdInput.trim()) {
      setStatus(dispatch, 'snapshot', createStatus('先にスタートリスト ID を設定してください。', 'error'));
      return;
    }
    try {
      setLoading(dispatch, 'snapshot', true);
      const snapshot = await api.fetchSnapshot({ startlistId: startlistIdInput.trim() });
      updateSnapshot(dispatch, snapshot);
      setStatus(dispatch, 'snapshot', createStatus('最新スナップショットを取得しました。', 'success'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'スナップショットの取得に失敗しました。';
      setStatus(dispatch, 'snapshot', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'snapshot', false);
    }
  };

  return (
    <section aria-labelledby="settings-heading">
      <header>
        <h2 id="settings-heading">スタートリスト基本情報</h2>
        <p className="muted">イベント ID やインターバルなど、スタートリスト生成の前提条件を入力します。</p>
      </header>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          スタートリスト ID
          <input value={startlistIdInput} onChange={(event) => setStartlistIdInput(event.target.value)} placeholder="SL-2024" required />
        </label>
        <label>
          イベント ID
          <input value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="event-001" />
        </label>
        <label>
          開始時刻
          <input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
        </label>
        <div className="form-grid columns-2">
          <label>
            インターバル (分)
            <input type="number" min={0} value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} />
          </label>
          <label>
            インターバル (秒)
            <input type="number" min={0} max={59} value={intervalSeconds} onChange={(event) => setIntervalSeconds(Number(event.target.value))} />
          </label>
        </div>
        <label>
          レーン数
          <input type="number" min={1} value={laneCount} onChange={(event) => setLaneCount(Number(event.target.value))} />
        </label>
        <div className="actions-row">
          <button type="submit" disabled={loading.settings}>設定を送信</button>
          <button type="button" className="secondary" onClick={handleRefreshSnapshot} disabled={loading.snapshot}>
            最新スナップショット取得
          </button>
        </div>
      </form>
      <StatusMessage tone={statuses.settings.level} message={statuses.settings.text} />
    </section>
  );
};

export default SettingsForm;
