import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createInputStepViewModel } from '../createInputStepViewModel';
import type { SettingsFormProps } from '../../components/SettingsForm';
import {
  createStatus,
  setStatus,
  updateLaneAssignments,
  useStartlistClassSplitResult,
  useStartlistClassSplitRules,
  useStartlistDispatch,
  useStartlistEntries,
  useStartlistStatuses,
  useStartlistStartOrderRules,
  useStartlistWorldRankingByClass,
} from '../../state/StartlistContext';
import { STARTLIST_STEP_PATHS } from '../../routes';
import { generateLaneAssignments } from '../../utils/startlistUtils';
import { useSettingsForm } from '../../hooks/useSettingsForm';
import { sanitizeActiveTab } from '../utils';
import type { Entry } from '../../state/types';

export const useInputStepController = () => {
  const entries = useStartlistEntries();
  const statuses = useStartlistStatuses();
  const classSplitRules = useStartlistClassSplitRules();
  const classSplitResult = useStartlistClassSplitResult();
  const startOrderRules = useStartlistStartOrderRules();
  const worldRankingByClass = useStartlistWorldRankingByClass();
  const dispatch = useStartlistDispatch();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<string>('all');

  const settingsForm = useSettingsForm();

  const viewModel = useMemo(
    () => createInputStepViewModel({ entries, activeTab }),
    [entries, activeTab],
  );

  useEffect(() => {
    const nextActive = sanitizeActiveTab(viewModel.tabs, activeTab, 'all');
    if (nextActive !== activeTab) {
      setActiveTab(nextActive);
    }
  }, [activeTab, viewModel.tabs]);

  const handleTabChange = useCallback((nextTab: string) => {
    setActiveTab(nextTab);
  }, []);

  const handleSettingsFormSubmit = useCallback(() => {
    settingsForm.submit();
  }, [settingsForm]);

  const handleComplete = useCallback(() => {
    const { settings: nextSettings } = settingsForm.submit();
    if (!nextSettings) {
      return;
    }
    if (!entries.length) {
      setStatus(dispatch, 'lanes', createStatus('参加者を1人以上登録してください。', 'error'));
      return;
    }
    const intervalMs = nextSettings.intervals?.laneClass?.milliseconds ?? 0;
    if (!Number.isFinite(intervalMs) || intervalMs < 0) {
      setStatus(dispatch, 'lanes', createStatus('スタート間隔が正しく設定されていません。', 'error'));
      return;
    }
    const laneCount = nextSettings.laneCount ?? 0;
    if (!laneCount) {
      setStatus(dispatch, 'lanes', createStatus('レーン数を確認してください。', 'error'));
      return;
    }

    const { assignments, splitResult } = generateLaneAssignments(entries as Entry[], laneCount, intervalMs, {
      splitRules: classSplitRules,
      previousSplitResult: classSplitResult,
      startOrderRules,
      worldRankingByClass,
    });
    if (!assignments.length) {
      setStatus(
        dispatch,
        'lanes',
        createStatus('レーン割り当てを作成できませんでした。入力内容を確認してください。', 'error'),
      );
      return;
    }

    updateLaneAssignments(dispatch, assignments, splitResult);
    setStatus(dispatch, 'lanes', createStatus('自動でレーン割り当てを作成しました。', 'success'));
    navigate(STARTLIST_STEP_PATHS.lanes);
  }, [
    classSplitResult,
    classSplitRules,
    dispatch,
    entries,
    navigate,
    settingsForm,
    startOrderRules,
    worldRankingByClass,
  ]);

  return {
    viewModel,
    activeTab,
    status: statuses.lanes,
    onTabChange: handleTabChange,
    onComplete: handleComplete,
    settingsForm: {
      fields: settingsForm.fields,
      errors: settingsForm.errors,
      laneIntervalOptions: settingsForm.laneIntervalOptions,
      playerIntervalOptions: settingsForm.playerIntervalOptions,
      status: settingsForm.status,
      onChange: settingsForm.onChange,
      onSubmit: handleSettingsFormSubmit,
    } satisfies SettingsFormProps,
  };
};
