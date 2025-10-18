import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
} from '@startlist-management/application';
import type { Entry } from '../state/types';
import {
  type ClassGroup,
  type ClassOrderWarning,
  createClassAssignmentsFromOrders,
  calculateClassOrderWarnings,
  seededRandomClassOrderPolicy,
  type ClassOrderPolicy,
} from './classOrderPolicy';

export const groupEntriesByClass = (entries: Entry[]): Map<string, Entry[]> => {
  const map = new Map<string, Entry[]>();
  entries.forEach((entry) => {
    const classId = entry.classId.trim();
    if (!map.has(classId)) {
      map.set(classId, []);
    }
    map.get(classId)!.push(entry);
  });
  return map;
};

export const generateLaneAssignments = (
  entries: Entry[],
  laneCount: number,
  laneIntervalMs: number,
): LaneAssignmentDto[] => {
  if (!laneCount || laneCount <= 0 || laneIntervalMs < 0) {
    return [];
  }
  const grouped = Array.from(groupEntriesByClass(entries).entries()).map<ClassGroup>(([classId, value]) => ({
    classId,
    entries: value,
  }));
  if (grouped.length === 0) {
    return [];
  }

  const lanes = Array.from({ length: laneCount }, (_, index) => ({
    laneNumber: index + 1,
    classOrder: [] as string[],
    load: 0,
  }));

  const sortedGroups = grouped.sort((a, b) => {
    const diff = b.entries.length - a.entries.length;
    if (diff !== 0) {
      return diff;
    }
    return a.classId.localeCompare(b.classId, 'ja');
  });

  sortedGroups.forEach((group) => {
    lanes.sort((a, b) => {
      const loadDiff = a.load - b.load;
      if (loadDiff !== 0) {
        return loadDiff;
      }
      return a.laneNumber - b.laneNumber;
    });
    lanes[0].classOrder.push(group.classId);
    lanes[0].load += group.entries.length;
  });

  return lanes
    .filter((lane) => lane.classOrder.length > 0)
    .sort((a, b) => a.laneNumber - b.laneNumber)
    .map<LaneAssignmentDto>((lane) => ({
      laneNumber: lane.laneNumber,
      classOrder: lane.classOrder,
      interval: { milliseconds: laneIntervalMs },
    }));
};

export const reorderLaneClass = (
  assignments: LaneAssignmentDto[],
  laneNumber: number,
  fromIndex: number,
  toIndex: number,
): LaneAssignmentDto[] => {
  return assignments.map((assignment) => {
    if (assignment.laneNumber !== laneNumber) {
      return assignment;
    }
    const classOrder = [...assignment.classOrder];
    const [moved] = classOrder.splice(fromIndex, 1);
    classOrder.splice(toIndex, 0, moved);
    return {
      ...assignment,
      classOrder,
    };
  });
};

export interface CreateDefaultClassAssignmentsOptions {
  entries: Entry[];
  playerIntervalMs: number;
  seed?: string;
  startlistId?: string;
  laneAssignments?: LaneAssignmentDto[];
  policy?: ClassOrderPolicy;
}

export interface CreateDefaultClassAssignmentsResult {
  assignments: ClassAssignmentDto[];
  seed: string;
  warnings: ClassOrderWarning[];
}

export const createDefaultClassAssignments = ({
  entries,
  playerIntervalMs,
  seed,
  startlistId,
  laneAssignments,
  policy = seededRandomClassOrderPolicy,
}: CreateDefaultClassAssignmentsOptions): CreateDefaultClassAssignmentsResult => {
  const groups = Array.from(groupEntriesByClass(entries).entries()).map<ClassGroup>(([classId, value]) => ({
    classId,
    entries: value,
  }));
  const derivedSeed = policy.deriveSeed({
    seed,
    startlistId,
    entries,
    laneAssignments,
  });
  const { playerOrders, warnings } = policy.execute({ groups, seed: derivedSeed });
  return {
    assignments: createClassAssignmentsFromOrders(groups, playerOrders, playerIntervalMs),
    seed: derivedSeed,
    warnings: Array.from(warnings.values()),
  };
};

export const deriveClassOrderWarnings = (
  assignments: ClassAssignmentDto[],
  entries: Entry[],
): ClassOrderWarning[] => {
  if (!assignments.length) {
    return [];
  }
  const groups = Array.from(groupEntriesByClass(entries).entries()).map<ClassGroup>(([classId, value]) => ({
    classId,
    entries: value,
  }));
  const orderMap = new Map<string, string[]>(assignments.map((assignment) => [assignment.classId, assignment.playerOrder]));
  const warningMap = calculateClassOrderWarnings(groups, orderMap);
  return Array.from(warningMap.values());
};

export const updateClassPlayerOrder = (
  assignments: ClassAssignmentDto[],
  classId: string,
  fromIndex: number,
  toIndex: number,
): ClassAssignmentDto[] => {
  return assignments.map((assignment) => {
    if (assignment.classId !== classId) {
      return assignment;
    }
    const order = [...assignment.playerOrder];
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    return {
      ...assignment,
      playerOrder: order,
    };
  });
};

export interface StartTimeCalculationInput {
  settings?: StartlistSettingsDto;
  laneAssignments: LaneAssignmentDto[];
  classAssignments: ClassAssignmentDto[];
  entries: Entry[];
}

export const calculateStartTimes = ({
  settings,
  laneAssignments,
  classAssignments,
  entries,
}: StartTimeCalculationInput): StartTimeDto[] => {
  if (!settings?.startTime) {
    return [];
  }
  const baseTime = new Date(settings.startTime).getTime();
  const defaultLaneInterval = settings.intervals?.laneClass?.milliseconds ?? 0;
  const defaultPlayerInterval = settings.intervals?.classPlayer?.milliseconds ?? 0;
  if (!Number.isFinite(baseTime) || defaultPlayerInterval <= 0) {
    return [];
  }

  const classMap = new Map(classAssignments.map((assignment) => [assignment.classId, assignment]));
  const groupedEntries = groupEntriesByClass(entries);
  const seenPlayers = new Set<string>();
  const results: StartTimeDto[] = [];

  laneAssignments.forEach((lane) => {
    let offset = 0;
    lane.classOrder.forEach((classId, classIndex) => {
      const assignment = classMap.get(classId);
      const playerInterval = assignment?.interval?.milliseconds ?? defaultPlayerInterval;
      if (!playerInterval || playerInterval <= 0) {
        const laneGap = lane.interval?.milliseconds ?? defaultLaneInterval;
        if (laneGap > 0) {
          offset += laneGap;
        }
        return;
      }
      const playerOrder = assignment?.playerOrder?.length
        ? assignment.playerOrder
        : (groupedEntries.get(classId) ?? []).map((entry) => entry.id);

      playerOrder.forEach((playerId) => {
        if (!playerId || seenPlayers.has(playerId)) {
          return;
        }
        const start = new Date(baseTime + offset).toISOString();
        results.push({ playerId, startTime: start, laneNumber: lane.laneNumber });
        seenPlayers.add(playerId);
        offset += playerInterval;
      });
      if (classIndex < lane.classOrder.length - 1) {
        const laneGap = lane.interval?.milliseconds ?? defaultLaneInterval;
        if (laneGap > 0) {
          offset += laneGap;
        }
      }
    });
  });

  return results;
};
