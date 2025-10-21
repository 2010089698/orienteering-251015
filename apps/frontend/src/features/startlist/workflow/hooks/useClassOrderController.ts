import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import {
  createStatus,
  setLoading,
  setStatus,
  updateClassAssignments,
  updateSnapshot,
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
  useStartlistStartlistId,
  useStartlistStatuses,
} from '../../state/StartlistContext';
import { STARTLIST_STEP_PATHS } from '../../routes';
import {
  calculateStartTimes,
  deriveClassOrderWarnings,
  updateClassPlayerOrder,
} from '../../utils/startlistUtils';
import { downloadStartlistCsv } from '../../utils/startlistExport';
import { createClassOrderViewModel, parsePlayerItemId } from '../createClassOrderViewModel';
import { sanitizeActiveTab } from '../utils';
import { useStartlistApi } from '../../api/useStartlistApi';

export const useClassOrderController = () => {
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
  const startlistId = useStartlistStartlistId();
  const api = useStartlistApi();

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
    const fallback = viewModel.tabs[0]?.id ?? '';
    const nextActive = sanitizeActiveTab(viewModel.tabs, activeTab, fallback);
    if (nextActive !== activeTab) {
      setActiveTab(nextActive);
    }
  }, [activeTab, viewModel.tabs]);

  const handleTabChange = useCallback((nextTab: string) => {
    setActiveTab(nextTab);
  }, []);

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

  const handleBack = useCallback(() => {
    navigate(STARTLIST_STEP_PATHS.lanes);
  }, [navigate]);

  const handleFinalize = useCallback(async () => {
    if (!startlistId) {
      setStatus(dispatch, 'startTimes', createStatus('スタートリスト ID を設定してください。', 'error'));
      return;
    }
    if (classAssignments.length === 0) {
      setStatus(dispatch, 'classes', createStatus('クラス順序を送信してから確定してください。', 'error'));
      return;
    }
    if (startTimes.length === 0) {
      setStatus(dispatch, 'startTimes', createStatus('スタート時間を先に作成してください。', 'error'));
      return;
    }
    try {
      setLoading(dispatch, 'startTimes', true);
      const classOrderSnapshot = await api.assignPlayerOrder({
        startlistId,
        assignments: classAssignments,
      });
      updateSnapshot(dispatch, classOrderSnapshot);
      setStatus(dispatch, 'classes', createStatus('クラス順序を送信しました。', 'success'));
      if (classOrderSnapshot) {
        setStatus(dispatch, 'snapshot', createStatus('スナップショットを更新しました。', 'info'));
      }
      const assignedSnapshot = await api.assignStartTimes({ startlistId, startTimes });
      if (assignedSnapshot) {
        updateSnapshot(dispatch, assignedSnapshot);
      }
      const finalizedSnapshot = await api.finalize({ startlistId });
      updateSnapshot(dispatch, finalizedSnapshot);
      setStatus(dispatch, 'startTimes', createStatus('スタートリストを確定しました。', 'success'));
      setStatus(dispatch, 'snapshot', createStatus('スタートリストを確定しました。', 'success'));
      navigate(STARTLIST_STEP_PATHS.link);
    } catch (error) {
      const message = error instanceof Error ? error.message : '確定処理に失敗しました。';
      setStatus(dispatch, 'startTimes', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'startTimes', false);
    }
  }, [
    api,
    classAssignments,
    dispatch,
    navigate,
    startTimes,
    startlistId,
  ]);

  return {
    viewModel,
    activeTab,
    sensors,
    statuses: {
      startTimes: statuses.startTimes,
    },
    loadingStartTimes: Boolean(loading.startTimes) || startTimes.length === 0,
    onTabChange: handleTabChange,
    onMove: handleMove,
    onDragEnd: handleDragEnd,
    onExportCsv: handleExportCsv,
    onBack: handleBack,
    onFinalize: handleFinalize,
    entryMap: viewModel.entryMap,
    splitLookup: viewModel.splitLookup,
  };
};
