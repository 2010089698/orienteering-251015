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

const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;

const toTokyoInputValue = (value?: Date | string): string => {
  if (!value) {
    return '';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const tokyoDate = new Date(date.getTime() + TOKYO_OFFSET_MS);
  const year = tokyoDate.getUTCFullYear();
  const month = String(tokyoDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tokyoDate.getUTCDate()).padStart(2, '0');
  const hours = String(tokyoDate.getUTCHours()).padStart(2, '0');
  const minutes = String(tokyoDate.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const fromTokyoInputValue = (value: string): string => {
  if (!value) {
    return '';
  }
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) {
    return '';
  }
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) {
    return '';
  }
  const tokyoUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(tokyoUtcMs - TOKYO_OFFSET_MS).toISOString();
};

const getNextSundayAtTenJst = (): string => {
  const now = new Date();
  const nowInTokyo = new Date(now.getTime() + TOKYO_OFFSET_MS);
  const dayOfWeek = nowInTokyo.getUTCDay();
  let daysToAdd = (7 - dayOfWeek) % 7;
  if (daysToAdd === 0) {
    daysToAdd = 7;
  }
  const targetUtc = Date.UTC(
    nowInTokyo.getUTCFullYear(),
    nowInTokyo.getUTCMonth(),
    nowInTokyo.getUTCDate() + daysToAdd,
    10,
    0,
    0,
    0,
  );
  return new Date(targetUtc - TOKYO_OFFSET_MS).toISOString();
};

const extractInterval = (interval?: StartlistSettingsDto['interval']) => {
  const milliseconds = interval?.milliseconds ?? 60000;
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return { minutes, seconds };
};

const SettingsForm = (): JSX.Element => {
  const { settings, startlistId, statuses } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const [startlistIdInput, setStartlistIdInput] = useState(startlistId);
  const [eventId, setEventId] = useState(settings?.eventId ?? '');
  const [intervalType, setIntervalType] = useState<StartlistSettingsDto['intervalType']>(
    settings?.intervalType ?? 'player',
  );
  const [startTime, setStartTime] = useState(() => toTokyoInputValue(settings?.startTime ?? getNextSundayAtTenJst()));
  const initialInterval = useMemo(() => extractInterval(settings?.interval), [settings]);
  const [intervalMinutes, setIntervalMinutes] = useState(initialInterval.minutes);
  const [intervalSeconds, setIntervalSeconds] = useState(initialInterval.seconds);
  const [laneCount, setLaneCount] = useState(settings?.laneCount ?? 1);

  useEffect(() => {
    setStartlistIdInput(startlistId);
  }, [startlistId]);

  useEffect(() => {
    setEventId(settings?.eventId ?? '');
    setIntervalType(settings?.intervalType ?? 'player');
    setStartTime(toTokyoInputValue(settings?.startTime ?? getNextSundayAtTenJst()));
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

    const normalizedStartTime = fromTokyoInputValue(startTime);
    if (!normalizedStartTime) {
      setStatus(dispatch, 'settings', createStatus('開始時刻の形式が正しくありません。', 'error'));
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
      startTime: normalizedStartTime,
      interval: { milliseconds: intervalMs },
      laneCount: laneCount,
      intervalType,
    };

    updateSettings(dispatch, { startlistId: startlistIdInput.trim(), settings: nextSettings });
    setStatus(dispatch, 'settings', createStatus('基本情報を保存しました。', 'success'));
  };

  return (
    <section aria-labelledby="settings-heading">
      <header>
        <h2 id="settings-heading">スタートリストの基本情報</h2>
        <p className="muted">大会名や開始時刻など、スタートリスト作成に必要な内容を入力してください。すべての時刻は日本時間 (JST) で取り扱われます。</p>
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
        <fieldset className="interval-type-fieldset">
          <legend>インターバルの意味</legend>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="intervalType"
                value="player"
                checked={intervalType === 'player'}
                onChange={() => setIntervalType('player')}
              />
              選手間隔
            </label>
            <label>
              <input
                type="radio"
                name="intervalType"
                value="class"
                checked={intervalType === 'class'}
                onChange={() => setIntervalType('class')}
              />
              クラス間隔
            </label>
          </div>
          <p className="muted small-text">インターバルの意味を選択してください（デフォルトは 1 分の選手間隔です）。</p>
        </fieldset>
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
