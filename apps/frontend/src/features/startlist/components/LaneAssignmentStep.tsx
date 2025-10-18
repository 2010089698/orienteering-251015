import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import { DndContext, PointerSensor, type DragEndEvent, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createStatus,
  setStatus,
  updateClassAssignments,
  updateLaneAssignments,
  updateStartTimes,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import { calculateStartTimes, createDefaultClassAssignments, prepareClassSplits } from '../utils/startlistUtils';
import { seededRandomClassOrderPolicy, seededRandomUnconstrainedClassOrderPolicy } from '../utils/classOrderPolicy';
import type { LaneAssignmentDto } from '@startlist-management/application';
import { reorderLaneClass } from '../utils/startlistUtils';
import { Tabs } from '../../../components/tabs';
import type { Entry } from '../state/types';

type LaneAssignmentStepProps = {
  onBack: () => void;
  onConfirm: () => void;
};

interface LaneRow {
  classId: string;
  laneNumber: number;
}

type ClassSummary = {
  classId: string;
  competitorCount: number;
  timeRangeLabel?: string;
  baseClassId: string;
  splitIndex?: number;
  splitCount: number;
  displayName?: string;
};

type LaneSummary = {
  laneNumber: number;
  competitorCount: number;
  timeRangeLabel?: string;
  classSummaries: ClassSummary[];
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

const laneContainerId = (laneNumber: number) => `lane-${laneNumber}`;

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

const ClassCard = ({
  classId,
  laneNumber,
  onLaneChange,
  laneOptions,
  competitorCount,
  timeRangeLabel,
  helperText,
}: {
  classId: string;
  laneNumber: number;
  onLaneChange: (classId: string, lane: number) => void;
  laneOptions: number[];
  competitorCount: number;
  timeRangeLabel?: string;
  helperText?: string;
}): JSX.Element => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: classId });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`draggable-card${isDragging ? ' is-dragging' : ''}`} {...attributes} {...listeners}>
      <div className="draggable-card__header">
        <span>{classId}</span>
        <label className="visually-hidden" htmlFor={`lane-select-${classId}`}>
          {classId} のレーン
        </label>
        <select
          id={`lane-select-${classId}`}
          value={laneNumber}
          onChange={(event) => onLaneChange(classId, Number(event.target.value))}
        >
          {laneOptions.map((lane) => (
            <option key={lane} value={lane}>
              レーン {lane}
            </option>
          ))}
        </select>
      </div>
      {helperText ? <p className="draggable-card__helper muted small-text">{helperText}</p> : null}
      <div className="meta-info draggable-card__meta">
        <span className="meta-info__item">
          <span className="meta-info__label">人数</span>
          <span className="meta-info__value">{competitorCount}名</span>
        </span>
        <span className="meta-info__item">
          <span className="meta-info__label">時間帯</span>
          <span className={`meta-info__value${timeRangeLabel ? '' : ' is-muted'}`}>
            {timeRangeLabel ?? '未設定'}
          </span>
        </span>
      </div>
    </div>
  );
};

const LaneColumn = ({
  lane,
  summary,
  children,
}: {
  lane: LaneAssignmentDto;
  summary?: LaneSummary;
  children: ReactNode;
}): JSX.Element => {
  const { setNodeRef, isOver } = useDroppable({ id: laneContainerId(lane.laneNumber) });
  return (
    <div
      ref={setNodeRef}
      className={`lane-card droppable-card${isOver ? ' is-over' : ''}`}
      data-testid={`lane-column-${lane.laneNumber}`}
    >
      <h3>レーン {lane.laneNumber}</h3>
      {summary ? (
        <div className="meta-info lane-card__meta">
          <span className="meta-info__item">
            <span className="meta-info__label">人数</span>
            <span className="meta-info__value">{summary.competitorCount}名</span>
          </span>
          <span className="meta-info__item">
            <span className="meta-info__label">時間帯</span>
            <span className={`meta-info__value${summary.timeRangeLabel ? '' : ' is-muted'}`}>
              {summary.timeRangeLabel ?? '未設定'}
            </span>
          </span>
        </div>
      ) : null}
      {children}
    </div>
  );
};

const LaneAssignmentStep = ({ onBack, onConfirm }: LaneAssignmentStepProps): JSX.Element => {
  const {
    laneAssignments,
    entries,
    settings,
    statuses,
    startlistId,
    classAssignments: existingClassAssignments,
    classOrderSeed,
    classOrderPreferences,
    startOrderRules,
    worldRankingByClass,
    classSplitRules,
    classSplitResult,
  } = useStartlistState();
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

  const entryById = useMemo(() => {
    return new Map(entries.map((entry) => [entry.id, entry]));
  }, [entries]);

  const classEntriesBySplitId = useMemo(() => {
    const map = new Map<string, Entry[]>();
    splitPreparation.splitIdToEntryIds.forEach((ids, classId) => {
      const resolved = ids
        .map((id) => entryById.get(id))
        .filter((entry): entry is Entry => Boolean(entry));
      map.set(classId, resolved);
    });
    if (map.size === 0) {
      entries.forEach((entry) => {
        const classId = entry.classId.trim();
        const next = map.get(classId) ?? [];
        next.push(entry);
        map.set(classId, next);
      });
    }
    return map;
  }, [entries, entryById, splitPreparation]);

  const splitMetadataByClassId = useMemo(() => {
    const meta = new Map<
      string,
      { baseClassId: string; splitIndex?: number; splitCount: number; displayName?: string }
    >();
    const baseCounts = new Map<string, number>();
    splitPreparation.result?.splitClasses.forEach((item) => {
      const current = baseCounts.get(item.baseClassId) ?? 0;
      baseCounts.set(item.baseClassId, current + 1);
    });
    splitPreparation.result?.splitClasses.forEach((item) => {
      meta.set(item.classId, {
        baseClassId: item.baseClassId,
        splitIndex: item.splitIndex,
        splitCount: baseCounts.get(item.baseClassId) ?? 1,
        displayName: item.displayName,
      });
    });
    splitPreparation.splitIdToEntryIds.forEach((_ids, classId) => {
      if (!meta.has(classId)) {
        const baseClassId = splitPreparation.splitIdToBaseClassId.get(classId) ?? classId;
        meta.set(classId, { baseClassId, splitCount: 1 });
      }
    });
    return meta;
  }, [splitPreparation]);

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
        const entriesForClass = classEntriesBySplitId.get(classId) ?? [];
        const competitorCount = entriesForClass.length;
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
        return {
          classId,
          competitorCount,
          timeRangeLabel: competitorCount > 0 ? formatTimeRange(startMs, endMs) : undefined,
          baseClassId: meta?.baseClassId ?? classId,
          splitIndex: meta?.splitIndex,
          splitCount: meta?.splitCount ?? 1,
          displayName: meta?.displayName,
        };
      });
      const competitorCount = classSummaries.reduce((sum, summary) => sum + summary.competitorCount, 0);
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
    classEntriesBySplitId,
    laneIntervalMs,
    lanesWithPlaceholders,
    playerIntervalMs,
  ]);

  const laneSummaryMap = useMemo(() => {
    return new Map(laneSummaries.map((summary) => [summary.laneNumber, summary]));
  }, [laneSummaries]);

  const classSummaryMap = useMemo(() => {
    const map = new Map<string, ClassSummary>();
    laneSummaries.forEach((lane) => {
      lane.classSummaries.forEach((summary) => {
        map.set(`${lane.laneNumber}::${summary.classId}`, summary);
      });
    });
    return map;
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
        setStatus(dispatch, 'classes', createStatus('世界ランキングの CSV を読み込んでからクラス内順序を作成してください。', 'error'));
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
    onConfirm();
  };

  const [activeTab, setActiveTab] = useState('overview');

  const tabItems = useMemo(
    () => [
      { id: 'overview', label: 'すべてのレーン', panelId: 'lane-panel-overview' },
      ...lanesWithPlaceholders.map((lane) => ({
        id: `lane-${lane.laneNumber}`,
        label: `レーン ${lane.laneNumber}`,
        panelId: `lane-panel-${lane.laneNumber}`,
      })),
    ],
    [lanesWithPlaceholders],
  );

  useEffect(() => {
    if (activeTab === 'overview') {
      return;
    }
    const exists = tabItems.some((item) => item.id === activeTab);
    if (!exists) {
      setActiveTab('overview');
    }
  }, [activeTab, tabItems]);

  const focusedLaneNumber = activeTab === 'overview' ? undefined : Number(activeTab.replace('lane-', ''));
  const focusedLane = focusedLaneNumber
    ? lanesWithPlaceholders.find((lane) => lane.laneNumber === focusedLaneNumber)
    : undefined;
  const activePanelId = tabItems.find((item) => item.id === activeTab)?.panelId ?? 'lane-panel-overview';

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

  return (
    <section aria-labelledby="step2-heading">
      <header>
        <h2 id="step2-heading">STEP 2 レーン割り当ての調整</h2>
        <p className="muted">クラスカードをドラッグ＆ドロップしてレーンの割り当てや順序を調整してください。各カードのセレクトボックスからもレーンを変更できます。</p>
      </header>
      {laneRows.length === 0 ? (
        <p className="muted">まだレーンが作成されていません。STEP 1 から進めてください。</p>
      ) : (
        <>
          <div className="lane-tabs">
            <Tabs
              activeId={activeTab}
              items={tabItems}
              onChange={setActiveTab}
              idPrefix="lanes"
              ariaLabel="レーン表示の切り替え"
            />
          </div>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div
              className={activeTab === 'overview' ? 'lane-view lane-view--overview' : 'lane-view lane-view--focused'}
              role="tabpanel"
              id={activePanelId}
              aria-labelledby={`lanes-${activeTab}`}
              data-testid="lane-view"
            >
              {activeTab === 'overview' ? (
                <>
                  <div className="lane-board" data-testid="lane-board">
                    {lanesWithPlaceholders.map((lane) => (
                      <LaneColumn
                        key={lane.laneNumber}
                        lane={lane}
                        summary={laneSummaryMap.get(lane.laneNumber)}
                      >
                        <SortableContext items={lane.classOrder} strategy={verticalListSortingStrategy}>
                          <div className="lane-stack">
                            {lane.classOrder.length === 0 ? (
                              <p className="muted small-text">クラスをドラッグして割り当ててください。</p>
                            ) : (
                              lane.classOrder.map((classId) => {
                                const summary = classSummaryMap.get(`${lane.laneNumber}::${classId}`);
                                const helperParts: string[] = [];
                                if (summary && summary.baseClassId !== classId) {
                                  helperParts.push(summary.baseClassId);
                                }
                                if ((summary?.splitCount ?? 1) > 1) {
                                  const label = summary?.displayName
                                    ? `分割 ${summary.displayName}`
                                    : '分割';
                                  const position = summary?.splitIndex !== undefined
                                    ? `${summary.splitIndex + 1}/${summary.splitCount}`
                                    : undefined;
                                  helperParts.push(position ? `${label} (${position})` : label);
                                }
                                const helperText = helperParts.join(' • ');
                                return (
                                  <ClassCard
                                    key={classId}
                                    classId={classId}
                                    laneNumber={lane.laneNumber}
                                    onLaneChange={handleLaneChange}
                                    laneOptions={laneOptions}
                                    competitorCount={summary?.competitorCount ?? 0}
                                    timeRangeLabel={summary?.timeRangeLabel}
                                    helperText={helperText}
                                  />
                                );
                              })
                            )}
                          </div>
                        </SortableContext>
                      </LaneColumn>
                    ))}
                  </div>
                  <div className="lane-preview" data-testid="lane-preview">
                    {lanesWithPlaceholders.map((lane) => (
                      <div key={lane.laneNumber} className="lane-card">
                        <h3>レーン {lane.laneNumber}</h3>
                        <div className="meta-info lane-card__meta">
                          <span className="meta-info__item">
                            <span className="meta-info__label">人数</span>
                            <span className="meta-info__value">
                              {laneSummaryMap.get(lane.laneNumber)?.competitorCount ?? 0}名
                            </span>
                          </span>
                          <span className="meta-info__item">
                            <span className="meta-info__label">時間帯</span>
                            <span
                              className={`meta-info__value$${
                                laneSummaryMap.get(lane.laneNumber)?.timeRangeLabel ? '' : ' is-muted'
                              }`}
                            >
                              {laneSummaryMap.get(lane.laneNumber)?.timeRangeLabel ?? '未設定'}
                            </span>
                          </span>
                        </div>
                        {lane.classOrder.length === 0 ? (
                          <p className="muted">クラス未設定</p>
                        ) : (
                          <ul className="lane-card__class-list">
                            {lane.classOrder.map((classId) => {
                              const summary = classSummaryMap.get(`${lane.laneNumber}::${classId}`);
                              const helperParts: string[] = [];
                              if (summary && summary.baseClassId !== classId) {
                                helperParts.push(summary.baseClassId);
                              }
                              if ((summary?.splitCount ?? 1) > 1) {
                                const label = summary?.displayName
                                  ? `分割 ${summary.displayName}`
                                  : '分割';
                                const position = summary?.splitIndex !== undefined
                                  ? `${summary.splitIndex + 1}/${summary.splitCount}`
                                  : undefined;
                                helperParts.push(position ? `${label} (${position})` : label);
                              }
                              const helperText = helperParts.join(' • ');
                              return (
                                <li key={classId} className="lane-card__class-item">
                                  <span className="lane-card__class-name">{classId}</span>
                                  {helperText ? (
                                    <span className="lane-card__class-helper muted small-text">{helperText}</span>
                                  ) : null}
                                  <span className="lane-card__class-meta">
                                    <span>{summary?.competitorCount ?? 0}名</span>
                                    <span className={summary?.timeRangeLabel ? '' : 'muted small-text'}>
                                      {summary?.timeRangeLabel ?? '時間未設定'}
                                    </span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="lane-focused-layout">
                  <div className="lane-board lane-board--single" data-testid="lane-board">
                    {focusedLane ? (
                      <LaneColumn lane={focusedLane} summary={laneSummaryMap.get(focusedLane.laneNumber)}>
                        <SortableContext items={focusedLane.classOrder} strategy={verticalListSortingStrategy}>
                          <div className="lane-stack">
                            {focusedLane.classOrder.length === 0 ? (
                              <p className="muted small-text">クラスをドラッグして割り当ててください。</p>
                            ) : (
                              focusedLane.classOrder.map((classId) => {
                                const summary = classSummaryMap.get(`${focusedLane.laneNumber}::${classId}`);
                                const helperParts: string[] = [];
                                if (summary && summary.baseClassId !== classId) {
                                  helperParts.push(summary.baseClassId);
                                }
                                if ((summary?.splitCount ?? 1) > 1) {
                                  const label = summary?.displayName
                                    ? `分割 ${summary.displayName}`
                                    : '分割';
                                  const position = summary?.splitIndex !== undefined
                                    ? `${summary.splitIndex + 1}/${summary.splitCount}`
                                    : undefined;
                                  helperParts.push(position ? `${label} (${position})` : label);
                                }
                                const helperText = helperParts.join(' • ');
                                return (
                                  <ClassCard
                                    key={classId}
                                    classId={classId}
                                    laneNumber={focusedLane.laneNumber}
                                    onLaneChange={handleLaneChange}
                                    laneOptions={laneOptions}
                                    competitorCount={summary?.competitorCount ?? 0}
                                    timeRangeLabel={summary?.timeRangeLabel}
                                    helperText={helperText}
                                  />
                                );
                              })
                            )}
                          </div>
                        </SortableContext>
                      </LaneColumn>
                    ) : (
                      <p className="muted small-text">このレーンは現在利用できません。</p>
                    )}
                  </div>
                  <aside className="lane-preview lane-preview--compact" data-testid="lane-preview">
                    <h3 className="lane-preview__title">割り当てプレビュー</h3>
                    <ul className="lane-preview__list">
                      {lanesWithPlaceholders.map((lane) => (
                        <li key={lane.laneNumber} className="lane-preview__item">
                          <span className="lane-preview__lane-label">レーン {lane.laneNumber}</span>
                          <div className="meta-info lane-card__meta">
                            <span className="meta-info__item">
                              <span className="meta-info__label">人数</span>
                              <span className="meta-info__value">
                                {laneSummaryMap.get(lane.laneNumber)?.competitorCount ?? 0}名
                              </span>
                            </span>
                          <span className="meta-info__item">
                            <span className="meta-info__label">時間帯</span>
                            <span
                              className={`meta-info__value${
                                laneSummaryMap.get(lane.laneNumber)?.timeRangeLabel ? '' : ' is-muted'
                              }`}
                            >
                              {laneSummaryMap.get(lane.laneNumber)?.timeRangeLabel ?? '未設定'}
                            </span>
                          </span>
                          </div>
                          {lane.classOrder.length === 0 ? (
                            <span className="lane-preview__lane-classes muted">クラス未設定</span>
                          ) : (
                            <ul className="lane-card__class-list">
                              {lane.classOrder.map((classId) => {
                                const summary = classSummaryMap.get(`${lane.laneNumber}::${classId}`);
                                const helperParts: string[] = [];
                                if (summary && summary.baseClassId !== classId) {
                                  helperParts.push(summary.baseClassId);
                                }
                                if ((summary?.splitCount ?? 1) > 1) {
                                  const label = summary?.displayName
                                    ? `分割 ${summary.displayName}`
                                    : '分割';
                                  const position = summary?.splitIndex !== undefined
                                    ? `${summary.splitIndex + 1}/${summary.splitCount}`
                                    : undefined;
                                  helperParts.push(position ? `${label} (${position})` : label);
                                }
                                const helperText = helperParts.join(' • ');
                                return (
                                  <li key={classId} className="lane-card__class-item">
                                    <span className="lane-card__class-name">{classId}</span>
                                    {helperText ? (
                                      <span className="lane-card__class-helper muted small-text">{helperText}</span>
                                    ) : null}
                                    <span className="lane-card__class-meta">
                                      <span>{summary?.competitorCount ?? 0}名</span>
                                      <span className={summary?.timeRangeLabel ? '' : 'muted small-text'}>
                                        {summary?.timeRangeLabel ?? '時間未設定'}
                                      </span>
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </aside>
                </div>
              )}
            </div>
          </DndContext>
        </>
      )}
      <div className="actions-row step-actions">
        <button type="button" className="secondary" onClick={onBack}>
          戻る
        </button>
        <button type="button" onClick={handleConfirm} disabled={laneRows.length === 0}>
          割り当て確定（順番と時間を作成）
        </button>
      </div>
      <StatusMessage tone={statuses.lanes.level} message={statuses.lanes.text} />
      <StatusMessage tone={statuses.classes.level} message={statuses.classes.text} />
      <StatusMessage tone={statuses.startTimes.level} message={statuses.startTimes.text} />
    </section>
  );
};

export default LaneAssignmentStep;
