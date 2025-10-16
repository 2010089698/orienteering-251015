import { useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '@startlist-management/ui-components';
import type { StartlistSettingsDto } from '@startlist-management/application';
import {
  createStatus,
  setStatus,
  updateSettings,
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
  const { settings, startlistId, statuses } = useStartlistState();
  const dispatch = useStartlistDispatch();

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

    const nextSettings: StartlistSettingsDto = {
      eventId: eventId.trim(),
      startTime: new Date(startTime).toISOString(),
      interval: { milliseconds: intervalMs },
      laneCount: laneCount,
    };

    updateSettings(dispatch, { startlistId: startlistIdInput.trim(), settings: nextSettings });
    setStatus(dispatch, 'settings', createStatus('基本情報を保存しました。', 'success'));
  };

  return (
    <section aria-labelledby="settings-heading">
      <header>
        <h2 id="settings-heading">スタートリストの基本情報</h2>
        <p className="muted">大会名や開始時刻など、スタートリスト作成に必要な内容を入力してください。</p>
      </header>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          スタートリスト ID
          <input
            value={startlistIdInput}
            onChange={(event) => setStartlistIdInput(event.target.value)}
            placeholder="SL-2024"
            required
          />
        </label>
        <label>
          大会メモ（任意）
          <input value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="春の大会" />
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
          <button type="submit">基本情報を保存</button>
        </div>
      </form>
      <StatusMessage tone={statuses.settings.level} message={statuses.settings.text} />
    </section>
  );
};

export default SettingsForm;
