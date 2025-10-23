import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { StartlistSettingsDto } from '@startlist-management/application';

import { deriveClassOrderWarnings } from '../utils/startlistUtils';
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
  useStartlistEventContext,
  useStartlistSettings,
  useStartlistStartlistId,
  useStartlistStatuses,
} from '../state/StartlistContext';

import {
  SETTINGS_FORM_ERROR_MESSAGES,
  SETTINGS_SUCCESS_MESSAGE,
  createSettingsFormFields,
  validateSettingsFormFields,
  type SettingsFormFields,
} from './utils/settingsForm';

const THIRTY_SECONDS_MS = 30000;

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

type SettingsFormFieldName = keyof SettingsFormFields;

type FormAction =
  | { type: 'hydrate'; payload: SettingsFormFields }
  | { type: 'updateField'; field: SettingsFormFieldName; value: SettingsFormFields[SettingsFormFieldName] }
  | { type: 'setError'; error: string | null };

type FormState = {
  fields: SettingsFormFields;
  error: string | null;
};

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'hydrate':
      return { fields: action.payload, error: null };
    case 'updateField':
      if (state.fields[action.field] === action.value) {
        return state.error ? { fields: state.fields, error: null } : state;
      }

      return {
        fields: { ...state.fields, [action.field]: action.value } as SettingsFormFields,
        error: null,
      };
    case 'setError':
      if (state.error === action.error) {
        return state;
      }

      return { ...state, error: action.error };
    default:
      return state;
  }
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
  const eventContext = useStartlistEventContext();

  const initialFields = useMemo(
    () => createSettingsFormFields(settings, classOrderPreferences, eventContext),
    [classOrderPreferences, eventContext, settings],
  );

  const [formState, dispatchForm] = useReducer(formReducer, {
    fields: initialFields,
    error: null,
  });

  useEffect(() => {
    dispatchForm({ type: 'hydrate', payload: initialFields });
  }, [initialFields]);

  const isEventIdReadOnly = useMemo(
    () => !settings?.eventId && Boolean(eventContext.eventId),
    [eventContext.eventId, settings?.eventId],
  );

  const eventIdAutoFillNotice = useMemo(() => {
    if (!isEventIdReadOnly || !eventContext.eventId) {
      return undefined;
    }
    return `イベント ID「${eventContext.eventId}」は URL のクエリパラメーターから自動設定されています。変更する場合は URL の eventId を更新してください。`;
  }, [eventContext.eventId, isEventIdReadOnly]);

  const laneIntervalOptions = useMemo(
    () => ensureIntervalOption(createIntervalOptions(60, true), formState.fields.laneIntervalMs),
    [formState.fields.laneIntervalMs],
  );

  const playerIntervalOptions = useMemo(
    () => ensureIntervalOption(createIntervalOptions(5), formState.fields.playerIntervalMs),
    [formState.fields.playerIntervalMs],
  );

  const handleAvoidConsecutiveClubsChange = useCallback(
    (nextValue: boolean) => {
      dispatchForm({ type: 'updateField', field: 'avoidConsecutiveClubs', value: nextValue });
      updateClassOrderPreferences(dispatch, { avoidConsecutiveClubs: nextValue });

      if (classAssignments.length > 0) {
        if (nextValue) {
          const warnings = deriveClassOrderWarnings(classAssignments, entries, {
            splitRules: classSplitRules,
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
    const { settings: nextSettings, error } = validateSettingsFormFields(formState.fields);

    if (error || !nextSettings) {
      const normalizedError =
        error ?? SETTINGS_FORM_ERROR_MESSAGES.startTimeInvalid;
      setStatus(dispatch, 'settings', createStatus(normalizedError, 'error'));
      dispatchForm({ type: 'setError', error: normalizedError });
      return { error: normalizedError };
    }

    const ensuredStartlistId = startlistId?.trim() || createDefaultStartlistId();
    updateSettings(dispatch, { startlistId: ensuredStartlistId, settings: nextSettings });
    setStatus(dispatch, 'settings', createStatus(SETTINGS_SUCCESS_MESSAGE, 'success'));
    dispatchForm({ type: 'setError', error: null });

    return { settings: nextSettings };
  }, [dispatch, formState.fields, startlistId]);

  const handleEventIdChange = useCallback((value: string) => {
    dispatchForm({ type: 'updateField', field: 'eventId', value });
  }, []);

  const handleStartTimeChange = useCallback((value: string) => {
    dispatchForm({ type: 'updateField', field: 'startTime', value });
  }, []);

  const handleLaneIntervalChange = useCallback((value: number) => {
    dispatchForm({ type: 'updateField', field: 'laneIntervalMs', value });
  }, []);

  const handlePlayerIntervalChange = useCallback((value: number) => {
    dispatchForm({ type: 'updateField', field: 'playerIntervalMs', value });
  }, []);

  const handleLaneCountChange = useCallback((value: number) => {
    dispatchForm({ type: 'updateField', field: 'laneCount', value });
  }, []);

  return {
    fields: formState.fields,
    errors: { form: formState.error },
    laneIntervalOptions,
    playerIntervalOptions,
    status: statuses.settings,
    isEventIdReadOnly,
    eventIdAutoFillNotice,
    onChange: {
      eventId: handleEventIdChange,
      startTime: handleStartTimeChange,
      laneIntervalMs: handleLaneIntervalChange,
      playerIntervalMs: handlePlayerIntervalChange,
      laneCount: handleLaneCountChange,
      avoidConsecutiveClubs: handleAvoidConsecutiveClubsChange,
    },
    submit,
  } as const;
};

export type UseSettingsFormReturn = ReturnType<typeof useSettingsForm>;

export type { SettingsFormFields } from './utils/settingsForm';

