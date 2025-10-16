import { useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { DurationDto, StartlistSettingsDto } from '@startlist-management/application';
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

const extractInterval = (interval?: DurationDto) => {
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
  const [startTime, setStartTime] = useState(() => toTokyoInputValue(settings?.startTime ?? getNextSundayAtTenJst()));
  const initialLaneInterval = useMemo(() => extractInterval(settings?.intervals?.laneClass), [settings]);
  const [laneIntervalMinutes, setLaneIntervalMinutes] = useState(initialLaneInterval.minutes);
  const [laneIntervalSeconds, setLaneIntervalSeconds] = useState(initialLaneInterval.seconds);
  const initialPlayerInterval = useMemo(() => extractInterval(settings?.intervals?.classPlayer), [settings]);
  const [playerIntervalMinutes, setPlayerIntervalMinutes] = useState(initialPlayerInterval.minutes);
  const [playerIntervalSeconds, setPlayerIntervalSeconds] = useState(initialPlayerInterval.seconds);
  const [laneCount, setLaneCount] = useState(settings?.laneCount ?? 1);

  useEffect(() => {
    setStartlistIdInput(startlistId);
  }, [startlistId]);

  useEffect(() => {
    setEventId(settings?.eventId ?? '');
    setStartTime(toTokyoInputValue(settings?.startTime ?? getNextSundayAtTenJst()));
    const nextLaneInterval = extractInterval(settings?.intervals?.laneClass);
    setLaneIntervalMinutes(nextLaneInterval.minutes);
    setLaneIntervalSeconds(nextLaneInterval.seconds);
    const nextPlayerInterval = extractInterval(settings?.intervals?.classPlayer);
    setPlayerIntervalMinutes(nextPlayerInterval.minutes);
    setPlayerIntervalSeconds(nextPlayerInterval.seconds);
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

    const laneIntervalMs = (Number(laneIntervalMinutes) * 60 + Number(laneIntervalSeconds)) * 1000;
    if (!Number.isFinite(laneIntervalMs) || laneIntervalMs <= 0) {
      setStatus(dispatch, 'settings', createStatus('レーン内クラス間隔は 1 秒以上で設定してください。', 'error'));
      return;
    }

    const playerIntervalMs = (Number(playerIntervalMinutes) * 60 + Number(playerIntervalSeconds)) * 1000;
    if (!Number.isFinite(playerIntervalMs) || playerIntervalMs <= 0) {
      setStatus(dispatch, 'settings', createStatus('クラス内選手間隔は 1 秒以上で設定してください。', 'error'));
      return;
    }

    if (!Number.isInteger(laneCount) || laneCount <= 0) {
      setStatus(dispatch, 'settings', createStatus('レーン数は 1 以上の整数で入力してください。', 'error'));
      return;
    }

    const nextSettings: StartlistSettingsDto = {
      eventId: eventId.trim(),
      startTime: normalizedStartTime,
      intervals: {
        laneClass: { milliseconds: laneIntervalMs },
        classPlayer: { milliseconds: playerIntervalMs },
      },
      laneCount: laneCount,
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
      <form onSubmit={handleSubmit} className="form-grid" noValidate>
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
          <legend>レーン内クラス間隔</legend>
          <div className="form-grid columns-2">
            <label>
              レーン間隔 (分)
              <input
                type="number"
                min={0}
                value={laneIntervalMinutes}
                onChange={(event) => setLaneIntervalMinutes(Number(event.target.value))}
              />
            </label>
            <label>
              レーン間隔 (秒)
              <input
                type="number"
                min={0}
                max={59}
                value={laneIntervalSeconds}
                onChange={(event) => setLaneIntervalSeconds(Number(event.target.value))}
              />
            </label>
          </div>
          <p className="muted small-text">各レーンで次のクラスがスタートするまでの間隔を設定します。</p>
        </fieldset>
        <fieldset className="interval-type-fieldset">
          <legend>クラス内選手間隔</legend>
          <div className="form-grid columns-2">
            <label>
              選手間隔 (分)
              <input
                type="number"
                min={0}
                value={playerIntervalMinutes}
                onChange={(event) => setPlayerIntervalMinutes(Number(event.target.value))}
              />
            </label>
            <label>
              選手間隔 (秒)
              <input
                type="number"
                min={0}
                max={59}
                value={playerIntervalSeconds}
                onChange={(event) => setPlayerIntervalSeconds(Number(event.target.value))}
              />
            </label>
          </div>
          <p className="muted small-text">同じクラス内の選手が連続でスタートする間隔を設定します。</p>
        </fieldset>
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
