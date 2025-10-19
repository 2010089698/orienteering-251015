import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
} from '@startlist-management/application';

import type {
  ClassOrderPreferences,
  ClassOrderWarning,
  ClassSplitResult,
  ClassSplitRules,
  Entry,
} from '../state/types';
import { createSplitClassLookup } from '../utils/splitUtils';

const formatStartTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
    timeZoneName: 'short',
  });
};

const createTabKey = (value: string): string => {
  const sanitized = value
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase();
  const hash = Array.from(value).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0).toString(16);
  return `class-${sanitized || 'id'}-${hash}`;
};

export const playerItemId = (classId: string, playerId: string) => `${classId}::${playerId}`;

export const parsePlayerItemId = (
  value: string,
): { classId: string; playerId: string } | undefined => {
  const [classId, playerId] = value.split('::');
  if (!classId || !playerId) {
    return undefined;
  }
  return { classId, playerId };
};

export type StartTimeRow = {
  playerId: string;
  cardNo: string;
  name: string;
  club: string;
  classId: string;
  baseClassId: string;
  laneNumber: number;
  startTimeIso: string;
  startTimeLabel: string;
  startTimeMs: number;
};

export type ClassOrderWarningSummary = { classId: string; clubs: string[] };

export type ClassOrderTabItem = {
  tabId: string;
  panelId: string;
  label: string;
  assignment: ClassAssignmentDto;
  laneLabel?: string;
  sortKey: number;
};

export type ClassOrderViewModel = {
  entryMap: Map<string, Entry>;
  splitLookup: ReturnType<typeof createSplitClassLookup>;
  startTimeRowsByClass: Map<string, StartTimeRow[]>;
  classSummaries: Map<string, { count: number; firstStart?: string; lastStart?: string }>;
  laneSortInfo: Map<string, { laneNumber?: number; sortKey: number }>;
  classTabItems: ClassOrderTabItem[];
  tabs: { id: string; label: string; panelId: string }[];
  classTabMap: Map<string, ClassOrderTabItem>;
  warningSummaries: ClassOrderWarningSummary[];
  avoidConsecutiveClubs: boolean;
};

export interface CreateClassOrderViewModelOptions {
  classAssignments: ClassAssignmentDto[];
  startTimes: StartTimeDto[];
  entries: Entry[];
  laneAssignments: LaneAssignmentDto[];
  classOrderWarnings: ClassOrderWarning[];
  classOrderPreferences: ClassOrderPreferences;
  classSplitRules: ClassSplitRules;
  classSplitResult?: ClassSplitResult;
}

export const createClassOrderViewModel = ({
  classAssignments,
  startTimes,
  entries,
  laneAssignments,
  classOrderWarnings,
  classOrderPreferences,
  classSplitRules: _classSplitRules,
  classSplitResult,
}: CreateClassOrderViewModelOptions): ClassOrderViewModel => {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));

  const splitLookup = createSplitClassLookup({ classAssignments, splitResult: classSplitResult, entries });

  const startTimeRowsByClass = startTimes.reduce((acc, item) => {
    const entry = entryMap.get(item.playerId);
    const assignedClassId = splitLookup.getPlayerClassId(item.playerId) ?? entry?.classId ?? '不明';
    const baseClassId = splitLookup.getBaseClassId(assignedClassId);
    const isoValue = typeof item.startTime === 'string' ? item.startTime : new Date(item.startTime).toISOString();
    const timestamp = new Date(isoValue).getTime();
    const row: StartTimeRow = {
      playerId: item.playerId,
      cardNo: entry?.cardNo ?? item.playerId,
      name: entry?.name ?? '（名前未入力）',
      club: entry?.club ?? '（所属未入力）',
      classId: assignedClassId,
      baseClassId,
      laneNumber: item.laneNumber,
      startTimeIso: isoValue,
      startTimeLabel: formatStartTime(isoValue),
      startTimeMs: Number.isNaN(timestamp) ? Number.NaN : timestamp,
    };
    const list = acc.get(row.classId);
    if (list) {
      list.push(row);
    } else {
      acc.set(row.classId, [row]);
    }
    return acc;
  }, new Map<string, StartTimeRow[]>());

  const classSummaries = classAssignments.reduce((acc, assignment) => {
    const rows = startTimeRowsByClass.get(assignment.classId) ?? [];
    let firstRow: StartTimeRow | undefined;
    let lastRow: StartTimeRow | undefined;
    rows.forEach((row) => {
      if (Number.isNaN(row.startTimeMs)) {
        return;
      }
      if (!firstRow || row.startTimeMs < firstRow.startTimeMs) {
        firstRow = row;
      }
      if (!lastRow || row.startTimeMs > lastRow.startTimeMs) {
        lastRow = row;
      }
    });
    acc.set(assignment.classId, {
      count: assignment.playerOrder.length,
      firstStart: firstRow?.startTimeLabel,
      lastStart: lastRow?.startTimeLabel ?? firstRow?.startTimeLabel,
    });
    return acc;
  }, new Map<string, { count: number; firstStart?: string; lastStart?: string }>());

  const laneSortInfo = laneAssignments.reduce((map, lane) => {
    lane.classOrder.forEach((classId, index) => {
      const baseClassId = splitLookup.getBaseClassId(classId);
      const baseSortKey = lane.laneNumber * 1000 + index;
      const info = { laneNumber: lane.laneNumber, sortKey: baseSortKey };
      map.set(classId, info);
      if (!map.has(baseClassId)) {
        map.set(baseClassId, info);
      }
      const related = splitLookup.baseToClassIds.get(baseClassId);
      if (related) {
        related.forEach((relatedId, relatedIndex) => {
          const offsetInfo = {
            laneNumber: lane.laneNumber,
            sortKey: baseSortKey + relatedIndex / 10,
          };
          if (!map.has(relatedId)) {
            map.set(relatedId, offsetInfo);
          }
        });
      }
    });
    return map;
  }, new Map<string, { laneNumber?: number; sortKey: number }>());

  const classTabItems: ClassOrderTabItem[] = classAssignments
    .map((assignment, index) => {
      const summary = classSummaries.get(assignment.classId);
      const laneInfo = laneSortInfo.get(assignment.classId);
      const laneLabel = laneInfo?.laneNumber ? `レーン${laneInfo.laneNumber}` : undefined;
      const metaParts = [laneLabel, `${assignment.playerOrder.length}人`];
      if (summary?.firstStart) {
        if (summary.lastStart && summary.lastStart !== summary.firstStart) {
          metaParts.push(`${summary.firstStart}〜${summary.lastStart}`);
        } else {
          metaParts.push(summary.firstStart);
        }
      }
      const labelMeta = metaParts.filter((part): part is string => Boolean(part));
      const tabId = createTabKey(assignment.classId);
      return {
        tabId,
        panelId: `${tabId}-panel`,
        label: `${splitLookup.formatClassLabel(assignment.classId)}（${labelMeta.join('・')}）`,
        assignment,
        laneLabel,
        sortKey: laneInfo?.sortKey ?? Number.MAX_SAFE_INTEGER - (classAssignments.length - index),
      } satisfies ClassOrderTabItem;
    })
    .sort((a, b) => a.sortKey - b.sortKey);

  const tabs = classTabItems.map((item) => ({ id: item.tabId, label: item.label, panelId: item.panelId }));
  const classTabMap = new Map(classTabItems.map((item) => [item.tabId, item]));

  const avoidConsecutiveClubs = classOrderPreferences.avoidConsecutiveClubs;

  const warningSummaries: ClassOrderWarningSummary[] = avoidConsecutiveClubs
    ? (() => {
        const map = new Map<string, Set<string>>();
        classOrderWarnings.forEach((warning) => {
          const classIds = new Set<string>();
          warning.occurrences.forEach((occurrence) => {
            const prevClassId = splitLookup.getPlayerClassId(occurrence.previousPlayerId);
            const nextClassId = splitLookup.getPlayerClassId(occurrence.nextPlayerId);
            if (prevClassId) {
              classIds.add(prevClassId);
            }
            if (nextClassId) {
              classIds.add(nextClassId);
            }
          });
          const targets = classIds.size > 0 ? Array.from(classIds) : [warning.classId];
          targets.forEach((classId) => {
            const set = map.get(classId) ?? new Set<string>();
            warning.occurrences.forEach((occurrence) => {
              occurrence.clubs.forEach((club) => set.add(club));
            });
            map.set(classId, set);
          });
        });
        return Array.from(map.entries())
          .map(([classId, clubs]) => ({
            classId,
            clubs: Array.from(clubs).sort((a, b) => a.localeCompare(b, 'ja')),
          }))
          .sort((a, b) =>
            splitLookup
              .formatClassLabel(a.classId)
              .localeCompare(splitLookup.formatClassLabel(b.classId), 'ja'),
          );
      })()
    : [];

  return {
    entryMap,
    splitLookup,
    startTimeRowsByClass,
    classSummaries,
    laneSortInfo,
    classTabItems,
    tabs,
    classTabMap,
    warningSummaries,
    avoidConsecutiveClubs,
  };
};
