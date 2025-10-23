import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';

import {
  createStatus,
  setLoading,
  setStatus,
  updateClassAssignments,
  updateLaneAssignments,
  updateSnapshot,
  updateStartTimes,
  useStartlistClassAssignments,
  useStartlistClassOrderPreferences,
  useStartlistClassOrderSeed,
  useStartlistClassSplitResult,
  useStartlistClassSplitRules,
  useStartlistDispatch,
  useStartlistEntries,
  useStartlistLaneAssignments,
  useStartlistSettings,
  useStartlistStartOrderRules,
  useStartlistStartlistId,
  useStartlistStatuses,
  useStartlistWorldRankingByClass,
} from '../../state/StartlistContext';
import { STARTLIST_STEP_PATHS } from '../../routes';
import {
  calculateStartTimes,
  createDefaultClassAssignments,
  reorderLaneClass,
} from '../../utils/startlistUtils';
import {
  seededRandomClassOrderPolicy,
  seededRandomUnconstrainedClassOrderPolicy,
} from '../../utils/classOrderPolicy';
import { createLaneAssignmentViewModel, moveClassBetweenLanes } from '../createLaneAssignmentViewModel';
import { sanitizeActiveTab } from '../utils';
import { useStartlistApi } from '../../api/useStartlistApi';

export const useLaneAssignmentController = () => {
  const laneAssignments = useStartlistLaneAssignments();
  const entries = useStartlistEntries();
  const settings = useStartlistSettings();
  const statuses = useStartlistStatuses();
  const startlistId = useStartlistStartlistId();
  const existingClassAssignments = useStartlistClassAssignments();
  const classOrderSeed = useStartlistClassOrderSeed();
  const classOrderPreferences = useStartlistClassOrderPreferences();
  const startOrderRules = useStartlistStartOrderRules();
  const worldRankingByClass = useStartlistWorldRankingByClass();
  const classSplitRules = useStartlistClassSplitRules();
  const classSplitResult = useStartlistClassSplitResult();
  const dispatch = useStartlistDispatch();
  const navigate = useNavigate();
  const api = useStartlistApi();

  const [activeTab, setActiveTab] = useState<string>('overview');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const viewModel = useMemo(
    () =>
      createLaneAssignmentViewModel({
        entries,
        laneAssignments,
        settings,
        classSplitRules,
        classSplitResult,
        startOrderRules,
        worldRankingByClass,
      }),
    [
      classSplitResult,
      classSplitRules,
      entries,
      laneAssignments,
      settings,
      startOrderRules,
      worldRankingByClass,
    ],
  );

  useEffect(() => {
    const nextActive = sanitizeActiveTab(viewModel.tabs, activeTab, 'overview');
    if (nextActive !== activeTab) {
      setActiveTab(nextActive);
    }
  }, [activeTab, viewModel.tabs]);

  useEffect(() => {
    if (!laneAssignments.length) {
      return;
    }
    if (classSplitResult && classSplitResult.signature !== viewModel.splitPreparation.signature) {
      setStatus(
        dispatch,
        'lanes',
        createStatus('クラス分割の設定が変更されています。STEP 1 でレーン割り当てを再生成してください。', 'error'),
      );
    }
  }, [classSplitResult, dispatch, laneAssignments.length, viewModel.splitPreparation.signature]);

  const handleTabChange = useCallback((nextTab: string) => {
    setActiveTab(nextTab);
  }, []);

  const handleLaneChange = useCallback(
    (classId: string, nextLane: number) => {
      if (!viewModel.laneIntervalMs) {
        setStatus(dispatch, 'lanes', createStatus('スタート間隔を設定してください。', 'error'));
        return;
      }
      const updated = moveClassBetweenLanes(laneAssignments, classId, nextLane, viewModel.laneIntervalMs);
      updateLaneAssignments(dispatch, updated, viewModel.effectiveSplitResult);
      setStatus(dispatch, 'lanes', createStatus(`クラス「${classId}」をレーン ${nextLane} に移動しました。`, 'info'));
    },
    [dispatch, laneAssignments, viewModel.effectiveSplitResult, viewModel.laneIntervalMs],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = typeof event.active.id === 'string' ? event.active.id : undefined;
      const overId = typeof event.over?.id === 'string' ? event.over.id : undefined;
      if (!activeId || !overId || activeId === overId) {
        return;
      }
      const activeLane = laneAssignments.find((lane) => lane.classOrder.includes(activeId));
      if (!activeLane || !viewModel.laneIntervalMs) {
        return;
      }

      if (overId.startsWith('lane-')) {
        const laneNumber = Number(overId.replace('lane-', ''));
        if (!Number.isFinite(laneNumber) || laneNumber === activeLane.laneNumber) {
          return;
        }
        const updated = moveClassBetweenLanes(laneAssignments, activeId, laneNumber, viewModel.laneIntervalMs);
        updateLaneAssignments(dispatch, updated, viewModel.effectiveSplitResult);
        setStatus(dispatch, 'lanes', createStatus(`クラス「${activeId}」をレーン ${laneNumber} に移動しました。`, 'info'));
        return;
      }

      const targetLane = laneAssignments.find((lane) => lane.classOrder.includes(overId));
      if (!targetLane) {
        return;
      }
      const fromIndex = activeLane.classOrder.indexOf(activeId);
      if (targetLane.laneNumber === activeLane.laneNumber) {
        const toIndex = targetLane.classOrder.indexOf(overId);
        if (fromIndex === toIndex) {
          return;
        }
        const updated = reorderLaneClass(laneAssignments, activeLane.laneNumber, fromIndex, toIndex);
        updateLaneAssignments(dispatch, updated, viewModel.effectiveSplitResult);
        setStatus(dispatch, 'lanes', createStatus(`クラス「${activeId}」の順序を更新しました。`, 'info'));
        return;
      }
      const targetIndex = targetLane.classOrder.indexOf(overId);
      const updated = moveClassBetweenLanes(
        laneAssignments,
        activeId,
        targetLane.laneNumber,
        viewModel.laneIntervalMs,
        targetIndex,
      );
      updateLaneAssignments(dispatch, updated, viewModel.effectiveSplitResult);
      setStatus(
        dispatch,
        'lanes',
        createStatus(`クラス「${activeId}」をレーン ${targetLane.laneNumber} の位置 ${targetIndex + 1} に移動しました。`, 'info'),
      );
    },
    [dispatch, laneAssignments, viewModel.effectiveSplitResult, viewModel.laneIntervalMs],
  );

  const handleConfirm = useCallback(async () => {
    if (!startlistId) {
      setStatus(dispatch, 'lanes', createStatus('スタートリスト ID を設定してください。', 'error'));
      return;
    }
    if (!settings) {
      setStatus(dispatch, 'lanes', createStatus('基本情報を先に入力してください。', 'error'));
      return;
    }
    if (!laneAssignments.length) {
      setStatus(dispatch, 'lanes', createStatus('レーン割り当てを確認してください。', 'error'));
      return;
    }

    setLoading(dispatch, 'lanes', true);

    let laneOrderPersisted = false;
    let nextClassAssignments = existingClassAssignments;
    let nextSplitResult = classSplitResult;

    try {
      const snapshot = await api.assignLaneOrder({ startlistId, assignments: laneAssignments });
      updateSnapshot(dispatch, snapshot);
      setStatus(dispatch, 'lanes', createStatus('レーン割り当てを送信しました。', 'success'));
      laneOrderPersisted = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'レーン割り当ての送信に失敗しました。';
      setStatus(dispatch, 'lanes', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'lanes', false);
    }

    if (!laneOrderPersisted) {
      return;
    }

    if (!nextClassAssignments.length) {
      const missingWorldRankingClasses = startOrderRules
        .filter((rule) => rule.method === 'worldRanking' && rule.classId && !rule.csvName)
        .map((rule) => rule.classId as string);
      const missingJapanRankingClasses = startOrderRules
        .filter((rule) => rule.method === 'japanRanking' && rule.classId)
        .filter((rule) => {
          const ranking = worldRankingByClass.get(rule.classId as string);
          return !(ranking && ranking.size > 0);
        })
        .map((rule) => rule.classId as string);
      const missingRankingClasses = Array.from(new Set([...missingWorldRankingClasses, ...missingJapanRankingClasses]));
      if (missingRankingClasses.length > 0) {
        const messageParts: string[] = [];
        if (missingWorldRankingClasses.length > 0) {
          messageParts.push(`世界ランキング方式 (${missingWorldRankingClasses.join(', ')})`);
        }
        if (missingJapanRankingClasses.length > 0) {
          messageParts.push(`日本ランキング方式 (${missingJapanRankingClasses.join(', ')})`);
        }
        const message =
          messageParts.length > 0
            ? `${messageParts.join(' / ')} のデータが読み込まれていません。`
            : `ランキング方式のクラス (${missingRankingClasses.join(', ')}) のデータが読み込まれていません。`;
        setStatus(dispatch, 'startOrder', createStatus(message, 'error'));
        setStatus(
          dispatch,
          'classes',
          createStatus('ランキングデータを読み込んでからクラス内順序を作成してください。', 'error'),
        );
        return;
      }
      const policy = classOrderPreferences.avoidConsecutiveClubs
        ? seededRandomClassOrderPolicy
        : seededRandomUnconstrainedClassOrderPolicy;
      const { assignments, seed, warnings, splitResult } = createDefaultClassAssignments({
        entries,
        playerIntervalMs: viewModel.playerIntervalMs || viewModel.laneIntervalMs,
        laneAssignments,
        startlistId,
        seed: classOrderSeed,
        policy,
        startOrderRules,
        worldRankingByClass,
        splitRules: classSplitRules,
      });
      nextClassAssignments = assignments;
      nextSplitResult = splitResult ?? nextSplitResult;
      updateClassAssignments(dispatch, assignments, seed, warnings, splitResult);
      if (assignments.length === 0) {
        setStatus(dispatch, 'classes', createStatus('クラス内順序を作成できませんでした。', 'error'));
        return;
      }
      if (classOrderPreferences.avoidConsecutiveClubs && warnings.length > 0) {
        setStatus(
          dispatch,
          'classes',
          createStatus(
            `${assignments.length} クラスの順序を自動で作成しましたが、${warnings.length} クラスで所属が連続する可能性があります。STEP 3 で詳細を確認してください。`,
            'info',
          ),
        );
      } else {
        setStatus(dispatch, 'classes', createStatus('クラス内の順序を自動で作成しました。', 'success'));
      }
    }

    const metadataForStartTimes = nextSplitResult ?? viewModel.effectiveSplitResult;
    const startTimes = calculateStartTimes({
      settings,
      laneAssignments,
      classAssignments: nextClassAssignments,
      entries,
      splitRules: classSplitRules,
      splitResult: metadataForStartTimes,
      startOrderRules,
      worldRankingByClass,
    });
    updateStartTimes(dispatch, startTimes, metadataForStartTimes);
    if (startTimes.length === 0) {
      setStatus(dispatch, 'startTimes', createStatus('スタート時間を作成できませんでした。', 'error'));
      return;
    }
    setStatus(dispatch, 'startTimes', createStatus('スタート時間を割り当てました。', 'success'));
    navigate(STARTLIST_STEP_PATHS.order);
  }, [
    api,
    classOrderPreferences.avoidConsecutiveClubs,
    classOrderSeed,
    classSplitResult,
    classSplitRules,
    dispatch,
    entries,
    existingClassAssignments,
    laneAssignments,
    navigate,
    settings,
    startOrderRules,
    startlistId,
    viewModel.effectiveSplitResult,
    viewModel.laneIntervalMs,
    viewModel.playerIntervalMs,
    worldRankingByClass,
  ]);

  const handleBack = useCallback(() => {
    navigate(STARTLIST_STEP_PATHS.input);
  }, [navigate]);

  const activePanelId = viewModel.tabs.find((tab) => tab.id === activeTab)?.panelId ?? 'lane-panel-overview';
  const focusedLaneNumber = activeTab === 'overview' ? undefined : Number(activeTab.replace('lane-', ''));
  const focusedLane =
    focusedLaneNumber && Number.isFinite(focusedLaneNumber)
      ? viewModel.lanesWithSummaries.find(({ lane }) => lane.laneNumber === focusedLaneNumber)
      : undefined;

  return {
    viewModel,
    activeTab,
    statuses: {
      lanes: statuses.lanes,
      classes: statuses.classes,
      startTimes: statuses.startTimes,
    },
    sensors,
    onTabChange: handleTabChange,
    onLaneChange: handleLaneChange,
    onDragEnd: handleDragEnd,
    onConfirm: handleConfirm,
    onBack: handleBack,
    activePanelId,
    focusedLane,
  };
};
