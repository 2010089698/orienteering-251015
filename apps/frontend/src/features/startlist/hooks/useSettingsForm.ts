import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StartlistSettingsDto } from '@startlist-management/application';

import { deriveClassOrderWarnings } from '../utils/startlistUtils';
import { fromTokyoInputValue, getNextSundayAtTenJst, toTokyoInputValue } from '../utils/time';
import {
  createDefaultStartlistId,
  createStatus,
  setStatus,
  updateClassAssignments,
  updateClassOrderPreferences,
  updateSettings,
  useStartlistClassAssignments,
  useStartlistClassOrderPreferences,
  useStartlistClassSplitResult,
  useStartlistClassSplitRules,
  useStartlistDispatch,
  useStartlistEntries,
  useStartlistSettings,
  useStartlistStartlistId,
  useStartlistStatuses,
} from '../state/StartlistContext';

const DEFAULT_LANE_INTERVAL_MS = 0;
const DEFAULT_PLAYER_INTERVAL_MS = 60000;
const THIRTY_SECONDS_MS = 30000;

const SETTINGS_SUCCESS_MESSAGE = '基本情報を保存しました。';
const START_TIME_REQUIRED_MESSAGE = '開始時刻を入力してください。';
const START_TIME_INVALID_MESSAGE = '開始時刻の形式が正しくありません。';
const LANE_INTERVAL_INVALID_MESSAGE = 'レーン内クラス間隔は 0 秒以上で設定してください。';
const PLAYER_INTERVAL_INVALID_MESSAGE = 'クラス内選手間隔は 1 秒以上で設定してください。';
const LANE_COUNT_INVALID_MESSAGE = 'レーン数は 1 以上の整数で入力してください。';

export type IntervalOption = { label: string; value: number };

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

export type SettingsFormSubmitResult = {
  settings?: StartlistSettingsDto;
  error?: string;
};

export const useSettingsForm = () => {
  const settings = useStartlistSettings();
  const startlistId = useStartlistStartlistId();
  const statuses = useStartlistStatuses();
  const classOrderPreferences = useStartlistClassOrderPreferences();
  const classAssignments = useStartlistClassAssignments();
  const entries = useStartlistEntries();
  const classSplitRules = useStartlistClassSplitRules();
  const classSplitResult = useStartlistClassSplitResult();
  const dispatch = useStartlistDispatch();

  const [startTime, setStartTime] = useState(() =>
    toTokyoInputValue(settings?.startTime ?? getNextSundayAtTenJst()),
  );
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
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setStartTime(toTokyoInputValue(settings?.startTime ?? getNextSundayAtTenJst()));
    setLaneIntervalMs(settings?.intervals?.laneClass?.milliseconds ?? DEFAULT_LANE_INTERVAL_MS);
    setPlayerIntervalMs(settings?.intervals?.classPlayer?.milliseconds ?? DEFAULT_PLAYER_INTERVAL_MS);
    setLaneCount(settings?.laneCount ?? 1);
  }, [settings]);

  useEffect(() => {
    setAvoidConsecutiveClubs(classOrderPreferences.avoidConsecutiveClubs);
  }, [classOrderPreferences.avoidConsecutiveClubs]);

  const laneIntervalOptions = useMemo(
    () => ensureIntervalOption(createIntervalOptions(60, true), laneIntervalMs),
    [laneIntervalMs],
  );

  const playerIntervalOptions = useMemo(
    () => ensureIntervalOption(createIntervalOptions(5), playerIntervalMs),
    [playerIntervalMs],
  );

  const handleAvoidConsecutiveClubsChange = useCallback(
    (nextValue: boolean) => {
      setAvoidConsecutiveClubs(nextValue);
      updateClassOrderPreferences(dispatch, { avoidConsecutiveClubs: nextValue });

      if (classAssignments.length > 0) {
        if (nextValue) {
          const warnings = deriveClassOrderWarnings(classAssignments, entries, {
            splitRules: classSplitRules,
            previousSplitResult: classSplitResult,
          });
          updateClassAssignments(dispatch, classAssignments, undefined, warnings, classSplitResult);
        } else {
          updateClassAssignments(dispatch, classAssignments, undefined, [], classSplitResult);
        }
      }
    },
    [
      classAssignments,
      classSplitResult,
      classSplitRules,
      dispatch,
      entries,
    ],
  );

  const submit = useCallback((): SettingsFormSubmitResult => {
    if (!startTime) {
      setStatus(dispatch, 'settings', createStatus(START_TIME_REQUIRED_MESSAGE, 'error'));
      setValidationError(START_TIME_REQUIRED_MESSAGE);
      return { error: START_TIME_REQUIRED_MESSAGE };
    }

    const normalizedStartTime = fromTokyoInputValue(startTime);
    if (!normalizedStartTime) {
      setStatus(dispatch, 'settings', createStatus(START_TIME_INVALID_MESSAGE, 'error'));
      setValidationError(START_TIME_INVALID_MESSAGE);
      return { error: START_TIME_INVALID_MESSAGE };
    }

    if (!Number.isFinite(laneIntervalMs) || laneIntervalMs < 0) {
      setStatus(dispatch, 'settings', createStatus(LANE_INTERVAL_INVALID_MESSAGE, 'error'));
      setValidationError(LANE_INTERVAL_INVALID_MESSAGE);
      return { error: LANE_INTERVAL_INVALID_MESSAGE };
    }

    if (!Number.isFinite(playerIntervalMs) || playerIntervalMs <= 0) {
      setStatus(dispatch, 'settings', createStatus(PLAYER_INTERVAL_INVALID_MESSAGE, 'error'));
      setValidationError(PLAYER_INTERVAL_INVALID_MESSAGE);
      return { error: PLAYER_INTERVAL_INVALID_MESSAGE };
    }

    if (!Number.isInteger(laneCount) || laneCount <= 0) {
      setStatus(dispatch, 'settings', createStatus(LANE_COUNT_INVALID_MESSAGE, 'error'));
      setValidationError(LANE_COUNT_INVALID_MESSAGE);
      return { error: LANE_COUNT_INVALID_MESSAGE };
    }

    const nextSettings: StartlistSettingsDto = {
      eventId: settings?.eventId ?? '',
      startTime: normalizedStartTime,
      intervals: {
        laneClass: { milliseconds: laneIntervalMs },
        classPlayer: { milliseconds: playerIntervalMs },
      },
      laneCount,
    };

    const ensuredStartlistId = startlistId?.trim() || createDefaultStartlistId();
    updateSettings(dispatch, { startlistId: ensuredStartlistId, settings: nextSettings });
    setStatus(dispatch, 'settings', createStatus(SETTINGS_SUCCESS_MESSAGE, 'success'));
    setValidationError(null);

    return { settings: nextSettings };
  }, [
    dispatch,
    laneCount,
    laneIntervalMs,
    playerIntervalMs,
    settings?.eventId,
    startTime,
    startlistId,
  ]);

  const handleStartTimeChange = useCallback((value: string) => {
    setStartTime(value);
  }, []);

  const handleLaneIntervalChange = useCallback((value: number) => {
    setLaneIntervalMs(value);
  }, []);

  const handlePlayerIntervalChange = useCallback((value: number) => {
    setPlayerIntervalMs(value);
  }, []);

  const handleLaneCountChange = useCallback((value: number) => {
    setLaneCount(value);
  }, []);

  return {
    startTime,
    laneIntervalMs,
    playerIntervalMs,
    laneCount,
    avoidConsecutiveClubs,
    laneIntervalOptions,
    playerIntervalOptions,
    status: statuses.settings,
    validationError,
    onStartTimeChange: handleStartTimeChange,
    onLaneIntervalChange: handleLaneIntervalChange,
    onPlayerIntervalChange: handlePlayerIntervalChange,
    onLaneCountChange: handleLaneCountChange,
    onAvoidConsecutiveClubsChange: handleAvoidConsecutiveClubsChange,
    submit,
  } as const;
};

export type UseSettingsFormReturn = ReturnType<typeof useSettingsForm>;

