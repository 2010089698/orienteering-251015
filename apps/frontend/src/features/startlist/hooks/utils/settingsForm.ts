import type { StartlistSettingsDto } from '@startlist-management/application';

import type { ClassOrderPreferences } from '../../state/types';
import { getNextSundayAtTenJst, toTokyoInputValue, fromTokyoInputValue } from '../../utils/time';

export const DEFAULT_LANE_INTERVAL_MS = 0;
export const DEFAULT_PLAYER_INTERVAL_MS = 60000;

export const SETTINGS_SUCCESS_MESSAGE = '基本情報を保存しました。';

export const SETTINGS_FORM_ERROR_MESSAGES = {
  startTimeRequired: '開始時刻を入力してください。',
  startTimeInvalid: '開始時刻の形式が正しくありません。',
  laneIntervalInvalid: 'レーン内クラス間隔は 0 秒以上で設定してください。',
  playerIntervalInvalid: 'クラス内選手間隔は 1 秒以上で設定してください。',
  laneCountInvalid: 'レーン数は 1 以上の整数で入力してください。',
} as const;

export type SettingsFormFields = {
  startTime: string;
  laneIntervalMs: number;
  playerIntervalMs: number;
  laneCount: number;
  avoidConsecutiveClubs: boolean;
};

export type SettingsFormValidationResult = {
  settings?: StartlistSettingsDto;
  error?: string;
};

export const createSettingsFormFields = (
  settings: StartlistSettingsDto | undefined,
  classOrderPreferences: ClassOrderPreferences,
): SettingsFormFields => ({
  startTime: toTokyoInputValue(settings?.startTime ?? getNextSundayAtTenJst()),
  laneIntervalMs: settings?.intervals?.laneClass?.milliseconds ?? DEFAULT_LANE_INTERVAL_MS,
  playerIntervalMs: settings?.intervals?.classPlayer?.milliseconds ?? DEFAULT_PLAYER_INTERVAL_MS,
  laneCount: settings?.laneCount ?? 1,
  avoidConsecutiveClubs: classOrderPreferences.avoidConsecutiveClubs,
});

export const validateSettingsFormFields = (
  fields: SettingsFormFields,
  eventId: string,
): SettingsFormValidationResult => {
  if (!fields.startTime) {
    return { error: SETTINGS_FORM_ERROR_MESSAGES.startTimeRequired };
  }

  const normalizedStartTime = fromTokyoInputValue(fields.startTime);
  if (!normalizedStartTime) {
    return { error: SETTINGS_FORM_ERROR_MESSAGES.startTimeInvalid };
  }

  if (!Number.isFinite(fields.laneIntervalMs) || fields.laneIntervalMs < 0) {
    return { error: SETTINGS_FORM_ERROR_MESSAGES.laneIntervalInvalid };
  }

  if (!Number.isFinite(fields.playerIntervalMs) || fields.playerIntervalMs <= 0) {
    return { error: SETTINGS_FORM_ERROR_MESSAGES.playerIntervalInvalid };
  }

  if (!Number.isInteger(fields.laneCount) || fields.laneCount <= 0) {
    return { error: SETTINGS_FORM_ERROR_MESSAGES.laneCountInvalid };
  }

  const settings: StartlistSettingsDto = {
    eventId,
    startTime: normalizedStartTime,
    intervals: {
      laneClass: { milliseconds: fields.laneIntervalMs },
      classPlayer: { milliseconds: fields.playerIntervalMs },
    },
    laneCount: fields.laneCount,
  };

  return { settings };
};
