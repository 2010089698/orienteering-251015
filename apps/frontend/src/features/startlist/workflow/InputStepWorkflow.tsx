import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import InputStep from '../components/InputStep';
import type { InputStepTab } from './createInputStepViewModel';
import { createInputStepViewModel } from './createInputStepViewModel';
import type { Entry } from '../state/types';
import {
  createStatus,
  setStatus,
  updateLaneAssignments,
  useStartlistClassSplitResult,
  useStartlistClassSplitRules,
  useStartlistDispatch,
  useStartlistEntries,
  useStartlistStatuses,
} from '../state/StartlistContext';
import { generateLaneAssignments } from '../utils/startlistUtils';
import { STARTLIST_STEP_PATHS } from '../routes';
import type { SettingsFormProps } from '../components/SettingsForm';
import { useSettingsForm } from '../hooks/useSettingsForm';

const sanitizeActiveTab = (tabs: InputStepTab[], activeTab: string): string => {
  if (activeTab === 'all') {
    return activeTab;
  }
  return tabs.some((tab) => tab.id === activeTab) ? activeTab : 'all';
};

const InputStepWorkflow = (): JSX.Element => {
  const entries = useStartlistEntries();
  const statuses = useStartlistStatuses();
  const classSplitRules = useStartlistClassSplitRules();
  const classSplitResult = useStartlistClassSplitResult();
  const dispatch = useStartlistDispatch();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<string>('all');
  const {
    startTime,
    laneIntervalMs,
    playerIntervalMs,
    laneCount,
    avoidConsecutiveClubs,
    laneIntervalOptions,
    playerIntervalOptions,
    status: settingsStatus,
    onStartTimeChange,
    onLaneIntervalChange,
    onPlayerIntervalChange,
    onLaneCountChange,
    onAvoidConsecutiveClubsChange,
    submit: submitSettings,
  } = useSettingsForm();

  const viewModel = useMemo(() => {
    return createInputStepViewModel({ entries, activeTab });
  }, [entries, activeTab]);

  useEffect(() => {
    const nextActive = sanitizeActiveTab(viewModel.tabs, activeTab);
    if (nextActive !== activeTab) {
      setActiveTab(nextActive);
    }
  }, [activeTab, viewModel.tabs]);

  const handleSettingsFormSubmit = useCallback(() => {
    submitSettings();
  }, [submitSettings]);

  const handleComplete = useCallback(() => {
    const { settings: nextSettings } = submitSettings();
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
  }, [classSplitResult, classSplitRules, dispatch, entries, navigate]);

  return (
    <InputStep
      tabs={viewModel.tabs}
      activeTab={viewModel.activeTab}
      onTabChange={setActiveTab}
      filteredEntries={viewModel.filteredEntries}
      onSubmit={handleComplete}
      status={statuses.lanes}
      settingsForm={{
        startTime,
        laneIntervalMs,
        playerIntervalMs,
        laneCount,
        avoidConsecutiveClubs,
        laneIntervalOptions,
        playerIntervalOptions,
        status: settingsStatus,
        onStartTimeChange,
        onLaneIntervalChange,
        onPlayerIntervalChange,
        onLaneCountChange,
        onAvoidConsecutiveClubsChange,
        onSubmit: handleSettingsFormSubmit,
      } satisfies SettingsFormProps}
    />
  );
};

export default InputStepWorkflow;
