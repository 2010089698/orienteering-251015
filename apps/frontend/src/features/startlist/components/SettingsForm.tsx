import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import type { ChangeEvent, ForwardedRef } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { DurationDto, StartlistSettingsDto } from '@startlist-management/application';
import { deriveClassOrderWarnings } from '../utils/startlistUtils';
import {
  createDefaultStartlistId,
  createStatus,
  setStatus,
  updateClassAssignments,
  updateSettings,
  updateClassOrderPreferences,
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

const DEFAULT_LANE_INTERVAL_MS = 0;
const DEFAULT_PLAYER_INTERVAL_MS = 60000;
const THIRTY_SECONDS_MS = 30000;

const formatIntervalLabel = (milliseconds: number): string => {
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes && seconds) {
    return `${minutes}分${seconds}秒`;
  }
  if (minutes) {
    return `${minutes}分`;
  }
  return `${seconds}秒`;
};

type IntervalOption = { label: string; value: number };

const createIntervalOptions = (maxMinutes: number, includeZero = false): IntervalOption[] => {
  const options: IntervalOption[] = [
    { label: '30秒', value: THIRTY_SECONDS_MS },
    ...Array.from({ length: maxMinutes }, (_, index) => {
      const minutes = index + 1;
      return { label: `${minutes}分`, value: minutes * 60000 };
    }),
  ];

  if (includeZero) {
    options.unshift({ label: 'なし', value: 0 });
  }

  return options;
};

const ensureIntervalOption = (options: IntervalOption[], value: number): IntervalOption[] => {
  if (options.some((option) => option.value === value)) {
    return options;
  }
  return [...options, { label: formatIntervalLabel(value), value }];
};

export type SettingsFormHandle = {
  validateAndSave: () => StartlistSettingsDto | null;
};

const SettingsForm = (_: unknown, ref: ForwardedRef<SettingsFormHandle>): JSX.Element => {
  const {
    settings,
    startlistId,
    statuses,
    classOrderPreferences,
    classAssignments,
    entries,
    classSplitRules,
    classSplitResult,
  } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const [startTime, setStartTime] = useState(() => toTokyoInputValue(settings?.startTime ?? getNextSundayAtTenJst()));
  const [laneIntervalMs, setLaneIntervalMs] = useState<number>(
    () => settings?.intervals?.laneClass?.milliseconds ?? DEFAULT_LANE_INTERVAL_MS,
  );
  const [playerIntervalMs, setPlayerIntervalMs] = useState<number>(
    () => settings?.intervals?.classPlayer?.milliseconds ?? DEFAULT_PLAYER_INTERVAL_MS,
  );
  const [laneCount, setLaneCount] = useState(settings?.laneCount ?? 1);
  const [avoidConsecutiveClubs, setAvoidConsecutiveClubs] = useState(
    () => classOrderPreferences.avoidConsecutiveClubs,
  );

  const laneIntervalOptions = useMemo(
    () => ensureIntervalOption(createIntervalOptions(60, true), laneIntervalMs),
    [laneIntervalMs],
  );
  const playerIntervalOptions = useMemo(
    () => ensureIntervalOption(createIntervalOptions(5), playerIntervalMs),
    [playerIntervalMs],
  );

  useEffect(() => {
    setStartTime(toTokyoInputValue(settings?.startTime ?? getNextSundayAtTenJst()));
    setLaneIntervalMs(settings?.intervals?.laneClass?.milliseconds ?? DEFAULT_LANE_INTERVAL_MS);
    setPlayerIntervalMs(settings?.intervals?.classPlayer?.milliseconds ?? DEFAULT_PLAYER_INTERVAL_MS);
    setLaneCount(settings?.laneCount ?? 1);
  }, [settings]);

  useEffect(() => {
    setAvoidConsecutiveClubs(classOrderPreferences.avoidConsecutiveClubs);
  }, [classOrderPreferences.avoidConsecutiveClubs]);

  const handlePreferenceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked;
    setAvoidConsecutiveClubs(nextValue);
    updateClassOrderPreferences(dispatch, { avoidConsecutiveClubs: nextValue });
    if (nextValue && classAssignments.length > 0) {
      const warnings = deriveClassOrderWarnings(classAssignments, entries, {
        splitRules: classSplitRules,
        previousSplitResult: classSplitResult,
      });
      updateClassAssignments(dispatch, classAssignments, undefined, warnings, classSplitResult);
    }
    if (!nextValue && classAssignments.length > 0) {
      updateClassAssignments(dispatch, classAssignments, undefined, [], classSplitResult);
    }
  };

  const validateAndSave = (): StartlistSettingsDto | null => {
    if (!startTime) {
      setStatus(dispatch, 'settings', createStatus('開始時刻を入力してください。', 'error'));
      return null;
    }

    const normalizedStartTime = fromTokyoInputValue(startTime);
    if (!normalizedStartTime) {
      setStatus(dispatch, 'settings', createStatus('開始時刻の形式が正しくありません。', 'error'));
      return null;
    }

    if (!Number.isFinite(laneIntervalMs) || laneIntervalMs < 0) {
      setStatus(dispatch, 'settings', createStatus('レーン内クラス間隔は 0 秒以上で設定してください。', 'error'));
      return null;
    }

    if (!Number.isFinite(playerIntervalMs) || playerIntervalMs <= 0) {
      setStatus(dispatch, 'settings', createStatus('クラス内選手間隔は 1 秒以上で設定してください。', 'error'));
      return null;
    }

    if (!Number.isInteger(laneCount) || laneCount <= 0) {
      setStatus(dispatch, 'settings', createStatus('レーン数は 1 以上の整数で入力してください。', 'error'));
      return null;
    }

    const nextSettings: StartlistSettingsDto = {
      eventId: settings?.eventId ?? '',
      startTime: normalizedStartTime,
      intervals: {
        laneClass: { milliseconds: laneIntervalMs },
        classPlayer: { milliseconds: playerIntervalMs },
      },
      laneCount: laneCount,
    };

    const ensuredStartlistId = startlistId?.trim() || createDefaultStartlistId();
    updateSettings(dispatch, { startlistId: ensuredStartlistId, settings: nextSettings });
    setStatus(dispatch, 'settings', createStatus('基本情報を保存しました。', 'success'));

    return nextSettings;
  };

  useImperativeHandle(ref, () => ({ validateAndSave }));

  return (
    <section aria-labelledby="settings-heading">
      <header>
        <h2 id="settings-heading">スタートリストの基本情報</h2>
        <p className="muted">大会名や開始時刻など、スタートリスト作成に必要な内容を入力してください。すべての時刻は日本時間 (JST) で取り扱われます。</p>
      </header>
      <form onSubmit={(event) => event.preventDefault()} className="form-grid" noValidate>
        <label>
          開始時刻
          <input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
        </label>
        <label>
          レーン内クラス間隔
          <select value={laneIntervalMs} onChange={(event) => setLaneIntervalMs(Number(event.target.value))}>
            {laneIntervalOptions
              .slice()
              .sort((a, b) => a.value - b.value)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          クラス内選手間隔
          <select value={playerIntervalMs} onChange={(event) => setPlayerIntervalMs(Number(event.target.value))}>
            {playerIntervalOptions
              .slice()
              .sort((a, b) => a.value - b.value)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          レーン数
          <input type="number" min={1} value={laneCount} onChange={(event) => setLaneCount(Number(event.target.value))} />
        </label>
        <label className="form-checkbox">
          <input type="checkbox" checked={avoidConsecutiveClubs} onChange={handlePreferenceChange} />
          <span>
            同じ所属が連続で並ばないようにする
            <span className="form-checkbox__hint">
              チェックを外すと所属を考慮しない完全ランダムで並び替えます。
            </span>
          </span>
        </label>
      </form>
      <StatusMessage tone={statuses.settings.level} message={statuses.settings.text} />
    </section>
  );
};

export default forwardRef(SettingsForm);
