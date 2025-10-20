import type { LaneAssignmentDto, StartlistSettingsDto } from '@startlist-management/application';

import type {
  ClassSplitResult,
  ClassSplitRules,
  Entry,
  StartOrderRules,
  WorldRankingByClass,
} from '../state/types';
import { buildClassSplitMetadata } from '../utils/classSplitMetadata';
import { prepareClassSplits, type ClassSplitPreparation } from '../utils/startlistUtils';

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

export type LaneAssignmentTab = { id: string; label: string; panelId: string };

export interface LaneAssignmentViewModelInput {
  entries: Entry[];
  laneAssignments: LaneAssignmentDto[];
  settings?: StartlistSettingsDto;
  classSplitRules: ClassSplitRules;
  classSplitResult?: ClassSplitResult;
  startOrderRules?: StartOrderRules;
  worldRankingByClass?: WorldRankingByClass;
}

export interface LaneAssignmentViewModel {
  laneRows: LaneRow[];
  laneOptions: number[];
  lanesWithPlaceholders: LaneAssignmentDto[];
  laneSummaries: LaneSummary[];
  laneSummaryMap: Map<number, LaneSummary>;
  lanesWithSummaries: LaneWithSummary[];
  tabs: LaneAssignmentTab[];
  laneCount: number;
  laneIntervalMs: number;
  playerIntervalMs: number;
  baseStartTimeMs?: number;
  canEstimateTimes: boolean;
  splitPreparation: ClassSplitPreparation;
  effectiveSplitResult?: ClassSplitResult;
}

export const laneContainerId = (laneNumber: number) => `lane-${laneNumber}`;

const ensureLaneRecords = (assignments: LaneAssignmentDto[], laneCount: number, intervalMs: number) => {
  const lanes = [...assignments];
  for (let laneNumber = 1; laneNumber <= laneCount; laneNumber += 1) {
    if (!lanes.some((lane) => lane.laneNumber === laneNumber)) {
      lanes.push({ laneNumber, classOrder: [], interval: { milliseconds: intervalMs } });
    }
  }
  return lanes.sort((a, b) => a.laneNumber - b.laneNumber);
};

export const moveClassBetweenLanes = (
  assignments: LaneAssignmentDto[],
  classId: string,
  targetLane: number,
  intervalMs: number,
  targetIndex?: number,
): LaneAssignmentDto[] => {
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

export const createLaneAssignmentViewModel = ({
  entries,
  laneAssignments,
  settings,
  classSplitRules,
  classSplitResult,
  startOrderRules,
  worldRankingByClass,
}: LaneAssignmentViewModelInput): LaneAssignmentViewModel => {
  const splitPreparation = prepareClassSplits(entries, {
    splitRules: classSplitRules,
    startOrderRules,
    worldRankingByClass,
  });

  const effectiveSplitResult =
    classSplitResult && classSplitResult.signature === splitPreparation.signature
      ? classSplitResult
      : splitPreparation.result;

  const laneCount = settings?.laneCount ?? laneAssignments.length;
  const laneIntervalMs =
    settings?.intervals?.laneClass?.milliseconds ?? laneAssignments[0]?.interval?.milliseconds ?? 0;
  const playerIntervalMs = settings?.intervals?.classPlayer?.milliseconds ?? 0;

  const baseStartTimeMs = (() => {
    if (!settings?.startTime) {
      return undefined;
    }
    const value = new Date(settings.startTime).getTime();
    return Number.isNaN(value) ? undefined : value;
  })();

  const canEstimateTimes = Boolean(baseStartTimeMs) && playerIntervalMs > 0;

  const lanesWithPlaceholders = ensureLaneRecords(laneAssignments, laneCount, laneIntervalMs);

  const laneRows: LaneRow[] = laneAssignments.flatMap((lane) =>
    lane.classOrder.map((classId) => ({ classId, laneNumber: lane.laneNumber })),
  );

  const laneOptions = Array.from({ length: laneCount }, (_, index) => index + 1);

  const { metadataByClassId: splitMetadataByClassId, countsByClassId: splitEntryCounts } =
    buildClassSplitMetadata({
      entries,
      laneAssignments,
      splitClasses: splitPreparation.result?.splitClasses,
      splitIdToEntryIds: splitPreparation.splitIdToEntryIds,
      splitIdToBaseClassId: splitPreparation.splitIdToBaseClassId,
    });

  const laneSummaries: LaneSummary[] = lanesWithPlaceholders.map((lane) => {
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
      return {
        classId,
        competitorCount,
        timeRangeLabel: competitorCount > 0 ? formatTimeRange(startMs, endMs) : undefined,
        baseClassId: meta?.baseClassId ?? classId,
        splitIndex: meta?.splitIndex,
        splitCount: meta?.partCount ?? 1,
        displayName: meta?.displayName,
        helperText: meta?.helperText,
      } satisfies ClassSummary;
    });

    const competitorCount = classSummaries.reduce((sum, item) => sum + item.competitorCount, 0);
    return {
      laneNumber: lane.laneNumber,
      competitorCount,
      timeRangeLabel: competitorCount > 0 ? formatTimeRange(laneStartMs, laneEndMs) : undefined,
      classSummaries,
    } satisfies LaneSummary;
  });

  const laneSummaryMap = new Map(laneSummaries.map((summary) => [summary.laneNumber, summary]));

  const lanesWithSummaries: LaneWithSummary[] = lanesWithPlaceholders.map((lane) => ({
    lane,
    summary:
      laneSummaryMap.get(lane.laneNumber) ?? {
        laneNumber: lane.laneNumber,
        competitorCount: 0,
        timeRangeLabel: undefined,
        classSummaries: [],
      },
  }));

  const tabs: LaneAssignmentTab[] = [
    { id: 'overview', label: 'すべてのレーン', panelId: 'lane-panel-overview' },
    ...lanesWithPlaceholders.map((lane) => ({
      id: laneContainerId(lane.laneNumber),
      label: `レーン ${lane.laneNumber}`,
      panelId: `lane-panel-${lane.laneNumber}`,
    })),
  ];

  return {
    laneRows,
    laneOptions,
    lanesWithPlaceholders,
    laneSummaries,
    laneSummaryMap,
    lanesWithSummaries,
    tabs,
    laneCount,
    laneIntervalMs,
    playerIntervalMs,
    baseStartTimeMs,
    canEstimateTimes,
    splitPreparation,
    effectiveSplitResult,
  };
};
