import { useEffect, useMemo } from 'react';
import { PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import type { LaneAssignmentDto } from '@startlist-management/application';

import {
  calculateStartTimes,
  createDefaultClassAssignments,
  prepareClassSplits,
  reorderLaneClass,
} from '../utils/startlistUtils';
import { buildClassSplitMetadata } from '../utils/classSplitMetadata';
import {
  createStatus,
  setStatus,
  updateClassAssignments,
  updateLaneAssignments,
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
} from '../state/StartlistContext';
import {
  seededRandomClassOrderPolicy,
  seededRandomUnconstrainedClassOrderPolicy,
} from '../utils/classOrderPolicy';

export type LaneRow = {
  classId: string;
  laneNumber: number;
};

export type ClassSummary = {
  classId: string;
  competitorCount: number;
  timeRangeLabel?: string;
  baseClassId: string;
  splitIndex?: number;
  splitCount: number;
  displayName?: string;
  helperText?: string;
};

export type LaneSummary = {
  laneNumber: number;
  competitorCount: number;
  timeRangeLabel?: string;
  classSummaries: ClassSummary[];
};

export type LaneWithSummary = {
  lane: LaneAssignmentDto;
  summary: LaneSummary;
};

export type UseLaneAssignmentStepProps = {
  onConfirm?: () => void;
};

const ensureLaneRecords = (assignments: LaneAssignmentDto[], laneCount: number, intervalMs: number) => {
  const lanes = [...assignments];
  for (let laneNumber = 1; laneNumber <= laneCount; laneNumber += 1) {
    if (!lanes.some((lane) => lane.laneNumber === laneNumber)) {
      lanes.push({
        laneNumber,
        classOrder: [],
        interval: { milliseconds: intervalMs },
      });
    }
  }
  return lanes.sort((a, b) => a.laneNumber - b.laneNumber);
};

const moveClassBetweenLanes = (
  assignments: LaneAssignmentDto[],
  classId: string,
  targetLane: number,
  intervalMs: number,
  targetIndex?: number,
) => {
  const sanitized = assignments.map((lane) => ({
    ...lane,
    classOrder: lane.classOrder.filter((item) => item !== classId),
  }));
  let target = sanitized.find((lane) => lane.laneNumber === targetLane);
  if (!target) {
    target = { laneNumber: targetLane, classOrder: [], interval: { milliseconds: intervalMs } };
    sanitized.push(target);
  }
  const order = [...target.classOrder];
  const index = targetIndex !== undefined ? Math.max(0, Math.min(targetIndex, order.length)) : order.length;
  order.splice(index, 0, classId);
  target.classOrder = order;
  if (!target.interval || target.interval.milliseconds <= 0) {
    target.interval = { milliseconds: intervalMs };
  }
  return sanitized
    .filter((lane) => lane.classOrder.length > 0)
    .sort((a, b) => a.laneNumber - b.laneNumber);
};

export const laneContainerId = (laneNumber: number) => `lane-${laneNumber}`;

const formatTime = (milliseconds?: number): string | undefined => {
  if (milliseconds === undefined) {
    return undefined;
  }
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  });
};

const formatTimeRange = (startMs?: number, endMs?: number): string | undefined => {
  const start = formatTime(startMs);
  if (!start) {
    return undefined;
  }
  const end = formatTime(endMs);
  if (!end || end === start) {
    return start;
  }
  return `${start}〜${end}`;
};

export const useLaneAssignmentStep = ({ onConfirm }: UseLaneAssignmentStepProps = {}) => {
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

  const splitPreparation = useMemo(
    () => prepareClassSplits(entries, { splitRules: classSplitRules }),
    [entries, classSplitRules],
  );

  const effectiveSplitResult = useMemo(() => {
    if (classSplitResult && classSplitResult.signature === splitPreparation.signature) {
      return classSplitResult;
    }
    return splitPreparation.result;
  }, [classSplitResult, splitPreparation]);

  const laneCount = settings?.laneCount ?? laneAssignments.length;
  const laneIntervalMs =
    settings?.intervals?.laneClass?.milliseconds ?? laneAssignments[0]?.interval?.milliseconds ?? 0;
  const playerIntervalMs = settings?.intervals?.classPlayer?.milliseconds ?? 0;

  const { metadataByClassId: splitMetadataByClassId, countsByClassId: splitEntryCounts } = useMemo(() => {
    return buildClassSplitMetadata({
      entries,
      laneAssignments,
      splitClasses: splitPreparation.result?.splitClasses,
      splitIdToEntryIds: splitPreparation.splitIdToEntryIds,
      splitIdToBaseClassId: splitPreparation.splitIdToBaseClassId,
    });
  }, [entries, laneAssignments, splitPreparation]);

  const baseStartTimeMs = useMemo(() => {
    if (!settings?.startTime) {
      return undefined;
    }
    const value = new Date(settings.startTime).getTime();
    return Number.isNaN(value) ? undefined : value;
  }, [settings?.startTime]);

  const canEstimateTimes = Boolean(baseStartTimeMs) && playerIntervalMs > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const laneRows = useMemo<LaneRow[]>(() => {
    return laneAssignments.flatMap((lane) => lane.classOrder.map((classId) => ({ classId, laneNumber: lane.laneNumber })));
  }, [laneAssignments]);

  const laneOptions = useMemo(() => {
    return Array.from({ length: laneCount }, (_, index) => index + 1);
  }, [laneCount]);

  const lanesWithPlaceholders = useMemo(
    () => ensureLaneRecords(laneAssignments, laneCount, laneIntervalMs),
    [laneAssignments, laneCount, laneIntervalMs],
  );

  const laneSummaries = useMemo<LaneSummary[]>(() => {
    return lanesWithPlaceholders.map((lane) => {
      let offset = 0;
      let laneStartMs: number | undefined;
      let laneEndMs: number | undefined;
      const classSummaries: ClassSummary[] = lane.classOrder.map((classId, index) => {
        const competitorCount = splitEntryCounts.get(classId) ?? 0;
        let startMs: number | undefined;
        let endMs: number | undefined;
        if (canEstimateTimes && baseStartTimeMs !== undefined) {
          startMs = baseStartTimeMs + offset;
          endMs = competitorCount > 0 ? startMs + (competitorCount - 1) * playerIntervalMs : startMs;
          if (competitorCount > 0) {
            if (laneStartMs === undefined) {
              laneStartMs = startMs;
            }
            laneEndMs = endMs;
            offset += competitorCount * playerIntervalMs;
          }
          if (index < lane.classOrder.length - 1) {
            const laneGap = lane.interval?.milliseconds ?? laneIntervalMs;
            if (laneGap > 0) {
              offset += laneGap;
            }
          }
        }
        const meta = splitMetadataByClassId.get(classId);
        const summary: ClassSummary = {
          classId,
          competitorCount,
          timeRangeLabel: competitorCount > 0 ? formatTimeRange(startMs, endMs) : undefined,
          baseClassId: meta?.baseClassId ?? classId,
          splitIndex: meta?.splitIndex,
          splitCount: meta?.partCount ?? 1,
          displayName: meta?.displayName,
          helperText: meta?.helperText,
        };
        return summary;
      });
      const competitorCount = classSummaries.reduce((sum, item) => sum + item.competitorCount, 0);
      return {
        laneNumber: lane.laneNumber,
        competitorCount,
        timeRangeLabel: competitorCount > 0 ? formatTimeRange(laneStartMs, laneEndMs) : undefined,
        classSummaries,
      };
    });
  }, [
    baseStartTimeMs,
    canEstimateTimes,
    splitEntryCounts,
    laneIntervalMs,
    lanesWithPlaceholders,
    playerIntervalMs,
    splitMetadataByClassId,
  ]);

  const laneSummaryMap = useMemo(() => {
    return new Map(laneSummaries.map((summary) => [summary.laneNumber, summary]));
  }, [laneSummaries]);

  const handleLaneChange = (classId: string, nextLane: number) => {
    if (!laneIntervalMs) {
      setStatus(dispatch, 'lanes', createStatus('スタート間隔を設定してください。', 'error'));
      return;
    }
    const updated = moveClassBetweenLanes(laneAssignments, classId, nextLane, laneIntervalMs);
    updateLaneAssignments(dispatch, updated, effectiveSplitResult);
    setStatus(dispatch, 'lanes', createStatus(`クラス「${classId}」をレーン ${nextLane} に移動しました。`, 'info'));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = typeof event.active.id === 'string' ? event.active.id : undefined;
    const overId = typeof event.over?.id === 'string' ? event.over.id : undefined;
    if (!activeId || !overId || activeId === overId) {
      return;
    }
    const activeLane = laneAssignments.find((lane) => lane.classOrder.includes(activeId));
    if (!activeLane || !laneIntervalMs) {
      return;
    }

    if (overId.startsWith('lane-')) {
      const laneNumber = Number(overId.replace('lane-', ''));
      if (!Number.isFinite(laneNumber) || laneNumber === activeLane.laneNumber) {
        return;
      }
      const updated = moveClassBetweenLanes(laneAssignments, activeId, laneNumber, laneIntervalMs);
      updateLaneAssignments(dispatch, updated, effectiveSplitResult);
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
      updateLaneAssignments(dispatch, updated, effectiveSplitResult);
      setStatus(dispatch, 'lanes', createStatus(`クラス「${activeId}」の順序を更新しました。`, 'info'));
      return;
    }
    const targetIndex = targetLane.classOrder.indexOf(overId);
    const updated = moveClassBetweenLanes(
      laneAssignments,
      activeId,
      targetLane.laneNumber,
      laneIntervalMs,
      targetIndex,
    );
    updateLaneAssignments(dispatch, updated, effectiveSplitResult);
    setStatus(
      dispatch,
      'lanes',
      createStatus(`クラス「${activeId}」をレーン ${targetLane.laneNumber} の位置 ${targetIndex + 1} に移動しました。`, 'info'),
    );
  };

  const handleConfirm = () => {
    if (!settings) {
      setStatus(dispatch, 'lanes', createStatus('基本情報を先に入力してください。', 'error'));
      return;
    }
    if (!laneAssignments.length) {
      setStatus(dispatch, 'lanes', createStatus('レーン割り当てを確認してください。', 'error'));
      return;
    }
    let nextClassAssignments = existingClassAssignments;
    let nextSplitResult = classSplitResult;
    if (!nextClassAssignments.length) {
      const missingCsvClasses = startOrderRules
        .filter((rule) => rule.method === 'worldRanking' && rule.classId && !rule.csvName)
        .map((rule) => rule.classId as string);
      if (missingCsvClasses.length > 0) {
        const message = `世界ランキング方式のクラス (${missingCsvClasses.join(', ')}) の CSV が読み込まれていません。`;
        setStatus(dispatch, 'startOrder', createStatus(message, 'error'));
        setStatus(
          dispatch,
          'classes',
          createStatus('世界ランキングの CSV を読み込んでからクラス内順序を作成してください。', 'error'),
        );
        return;
      }
      const policy = classOrderPreferences.avoidConsecutiveClubs
        ? seededRandomClassOrderPolicy
        : seededRandomUnconstrainedClassOrderPolicy;
      const { assignments, seed, warnings, splitResult } = createDefaultClassAssignments({
        entries,
        playerIntervalMs: playerIntervalMs || laneIntervalMs,
        laneAssignments,
        startlistId,
        seed: classOrderSeed,
        policy,
        startOrderRules,
        worldRankingByClass,
        splitRules: classSplitRules,
        previousSplitResult: classSplitResult,
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

    const metadataForStartTimes = nextSplitResult ?? effectiveSplitResult;
    const startTimes = calculateStartTimes({
      settings,
      laneAssignments,
      classAssignments: nextClassAssignments,
      entries,
      splitRules: classSplitRules,
      splitResult: metadataForStartTimes,
    });
    updateStartTimes(dispatch, startTimes, metadataForStartTimes);
    if (startTimes.length === 0) {
      setStatus(dispatch, 'startTimes', createStatus('スタート時間を作成できませんでした。', 'error'));
      return;
    }
    setStatus(dispatch, 'startTimes', createStatus('スタート時間を割り当てました。', 'success'));
    onConfirm?.();
  };

  useEffect(() => {
    if (!laneAssignments.length) {
      return;
    }
    if (classSplitResult && classSplitResult.signature !== splitPreparation.signature) {
      setStatus(
        dispatch,
        'lanes',
        createStatus('クラス分割の設定が変更されています。STEP 1 でレーン割り当てを再生成してください。', 'error'),
      );
    }
  }, [classSplitResult, dispatch, laneAssignments, splitPreparation.signature]);

  return {
    laneRows,
    laneOptions,
    lanesWithPlaceholders,
    laneSummaries,
    laneSummaryMap,
    sensors,
    statuses,
    handleLaneChange,
    handleDragEnd,
    handleConfirm,
  };
};

export type UseLaneAssignmentStepResult = ReturnType<typeof useLaneAssignmentStep>;
