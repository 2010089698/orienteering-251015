import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';

import ClassOrderStep from '../components/ClassOrderStep';
import {
  createStatus,
  setLoading,
  setStatus,
  updateClassAssignments,
  updateStartTimes,
  useStartlistClassAssignments,
  useStartlistClassOrderPreferences,
  useStartlistClassOrderWarnings,
  useStartlistClassSplitResult,
  useStartlistClassSplitRules,
  useStartlistDispatch,
  useStartlistEntries,
  useStartlistLaneAssignments,
  useStartlistLoading,
  useStartlistSettings,
  useStartlistStartTimes,
  useStartlistStatuses,
} from '../state/StartlistContext';
import {
  createClassOrderViewModel,
  parsePlayerItemId,
} from './createClassOrderViewModel';
import { STARTLIST_STEP_PATHS } from '../routes';
import {
  calculateStartTimes,
  deriveClassOrderWarnings,
  updateClassPlayerOrder,
} from '../utils/startlistUtils';
import { downloadStartlistCsv } from '../utils/startlistExport';

const sanitizeActiveTab = (tabs: { id: string }[], activeTab: string): string => {
  if (!tabs.length) {
    return '';
  }
  return tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0].id;
};

const ClassOrderWorkflow = (): JSX.Element => {
  const navigate = useNavigate();
  const classAssignments = useStartlistClassAssignments();
  const startTimes = useStartlistStartTimes();
  const settings = useStartlistSettings();
  const laneAssignments = useStartlistLaneAssignments();
  const entries = useStartlistEntries();
  const statuses = useStartlistStatuses();
  const loading = useStartlistLoading();
  const classOrderWarnings = useStartlistClassOrderWarnings();
  const classOrderPreferences = useStartlistClassOrderPreferences();
  const classSplitRules = useStartlistClassSplitRules();
  const classSplitResult = useStartlistClassSplitResult();
  const dispatch = useStartlistDispatch();

  const [activeTab, setActiveTab] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const viewModel = useMemo(
    () =>
      createClassOrderViewModel({
        classAssignments,
        startTimes,
        entries,
        laneAssignments,
        classOrderWarnings,
        classOrderPreferences,
        classSplitRules,
        classSplitResult,
      }),
    [
      classAssignments,
      classOrderWarnings,
      classOrderPreferences,
      classSplitResult,
      classSplitRules,
      entries,
      laneAssignments,
      startTimes,
    ],
  );

  useEffect(() => {
    const nextActive = sanitizeActiveTab(viewModel.tabs, activeTab);
    if (nextActive !== activeTab) {
      setActiveTab(nextActive);
    }
  }, [activeTab, viewModel.tabs]);

  const reorderWithinClass = useCallback(
    (classId: string, fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) {
        return;
      }
      const assignment = classAssignments.find((item) => item.classId === classId);
      if (!assignment || toIndex < 0 || toIndex >= assignment.playerOrder.length) {
        return;
      }
      const nextAssignments = updateClassPlayerOrder(classAssignments, classId, fromIndex, toIndex);
      const warnings = classOrderPreferences.avoidConsecutiveClubs
        ? deriveClassOrderWarnings(nextAssignments, entries, {
            splitRules: classSplitRules,
            previousSplitResult: classSplitResult,
          })
        : [];
      updateClassAssignments(dispatch, nextAssignments, undefined, warnings, classSplitResult);
      if (!settings) {
        return;
      }
      const nextStartTimes = calculateStartTimes({
        settings,
        laneAssignments,
        classAssignments: nextAssignments,
        entries,
        splitRules: classSplitRules,
        splitResult: classSplitResult,
      });
      updateStartTimes(dispatch, nextStartTimes, classSplitResult);
      setStatus(dispatch, 'classes', createStatus('順番を更新しました。', 'info'));
      setStatus(dispatch, 'startTimes', createStatus('スタート時間を再計算しました。', 'info'));
    },
    [
      classAssignments,
      classOrderPreferences.avoidConsecutiveClubs,
      classSplitResult,
      classSplitRules,
      dispatch,
      entries,
      laneAssignments,
      settings,
    ],
  );

  const handleMove = useCallback(
    (classId: string, index: number, direction: number) => {
      const targetIndex = index + direction;
      reorderWithinClass(classId, index, targetIndex);
    },
    [reorderWithinClass],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = typeof event.active.id === 'string' ? event.active.id : undefined;
      const overId = typeof event.over?.id === 'string' ? event.over.id : undefined;
      if (!activeId || !overId || activeId === overId) {
        return;
      }
      const active = parsePlayerItemId(activeId);
      const over = overId.startsWith('class-drop-')
        ? { classId: overId.replace('class-drop-', ''), playerId: '' }
        : parsePlayerItemId(overId);
      if (!active || !over || active.classId !== over.classId) {
        return;
      }
      const assignment = classAssignments.find((item) => item.classId === active.classId);
      if (!assignment) {
        return;
      }
      const fromIndex = assignment.playerOrder.indexOf(active.playerId);
      if (fromIndex === -1) {
        return;
      }
      const toIndex = over.playerId
        ? assignment.playerOrder.indexOf(over.playerId)
        : assignment.playerOrder.length - 1;
      if (toIndex === -1) {
        return;
      }
      reorderWithinClass(active.classId, fromIndex, toIndex);
    },
    [classAssignments, reorderWithinClass],
  );

  const handleExportCsv = useCallback(() => {
    if (startTimes.length === 0) {
      return;
    }
    setLoading(dispatch, 'startTimes', true);
    try {
      const count = downloadStartlistCsv({ entries, startTimes, classAssignments });
      setStatus(dispatch, 'startTimes', createStatus(`${count} 件のスタート時間をエクスポートしました。`, 'info'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV のエクスポートに失敗しました。';
      setStatus(dispatch, 'startTimes', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'startTimes', false);
    }
  }, [classAssignments, dispatch, entries, startTimes]);

  return (
    <ClassOrderStep
      tabs={viewModel.tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      classTabMap={viewModel.classTabMap}
      startTimeRowsByClass={viewModel.startTimeRowsByClass}
      classSummaries={viewModel.classSummaries}
      warningSummaries={viewModel.warningSummaries}
      avoidConsecutiveClubs={viewModel.avoidConsecutiveClubs}
      sensors={sensors}
      onDragEnd={handleDragEnd}
      onMove={handleMove}
      onExportCsv={handleExportCsv}
      onBack={() => navigate(STARTLIST_STEP_PATHS.lanes)}
      statuses={{ startTimes: statuses.startTimes }}
      loadingStartTimes={Boolean(loading.startTimes) || startTimes.length === 0}
      entryMap={viewModel.entryMap}
      splitLookup={viewModel.splitLookup}
    />
  );
};

export default ClassOrderWorkflow;
