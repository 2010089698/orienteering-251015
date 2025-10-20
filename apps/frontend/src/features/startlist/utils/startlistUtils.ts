import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
} from '@startlist-management/application';
import type {
  ClassSplitResult,
  ClassSplitRules,
  Entry,
  StartOrderMethod,
  StartOrderRules,
  WorldRankingByClass,
  WorldRankingMap,
} from '../state/types';
import {
  type ClassGroup,
  type ClassOrderWarning,
  createClassAssignmentsFromOrders,
  calculateClassOrderWarnings,
  seededRandomClassOrderPolicy,
  type ClassOrderPolicy,
  hashString,
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

const createSplitSuffix = (index: number): string => {
  return String(index + 1);
};

const createSplitDisplayName = (
  method: 'random' | 'rankingTopBottom' | 'rankingBalanced',
  index: number,
): string => {
  if (method === 'rankingTopBottom') {
    return index === 0 ? '上位' : '下位';
  }
  if (method === 'rankingBalanced') {
    return `均等${index + 1}`;
  }
  return createSplitSuffix(index);
};

const MIN_RANDOM_SEED = 1;

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
};

const shuffleWithRandom = <T>(values: T[], random: () => number): T[] => {
  const array = [...values];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    const temp = array[index];
    array[index] = array[randomIndex];
    array[randomIndex] = temp;
  }
  return array;
};

const createStartOrderMethodMap = (
  rules: StartOrderRules = [],
): Map<string, StartOrderMethod> => {
  const map = new Map<string, StartOrderMethod>();
  rules.forEach((rule) => {
    if (!rule.classId) {
      return;
    }
    map.set(rule.classId, rule.method);
  });
  return map;
};

const createWorldRankingByClassSignature = (
  worldRankingByClass?: WorldRankingByClass,
): string => {
  if (!worldRankingByClass) {
    return '';
  }
  return Array.from(worldRankingByClass.entries())
    .sort((left, right) => left[0].localeCompare(right[0], 'ja'))
    .map(([classId, ranking]) => {
      const rankingPart = Array.from(ranking.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iofId, position]) => `${iofId}:${position}`)
        .join('|');
      return `${classId}#${rankingPart}`;
    })
    .join('|');
};

interface RankedEntry {
  entry: Entry;
  position?: number;
}

const formatRankingPosition = (position?: number): string =>
  position === undefined ? 'NA' : String(position);

const sortEntriesByWorldRanking = (
  entries: Entry[],
  worldRanking?: WorldRankingMap,
): RankedEntry[] => {
  return entries
    .map((entry) => ({
      entry,
      position: entry.iofId ? worldRanking?.get(entry.iofId) : undefined,
    }))
    .sort((left, right) => {
      const leftRanked = left.position !== undefined;
      const rightRanked = right.position !== undefined;
      if (leftRanked && rightRanked) {
        if (left.position! !== right.position!) {
          return left.position! - right.position!;
        }
        return left.entry.id.localeCompare(right.entry.id, 'ja');
      }
      if (leftRanked) {
        return -1;
      }
      if (rightRanked) {
        return 1;
      }
      return left.entry.id.localeCompare(right.entry.id, 'ja');
    });
};

const createRankingTopBottomSplit = (
  baseClassId: string,
  entries: Entry[],
  worldRanking?: WorldRankingMap,
): { groups: Entry[][]; signature: string } => {
  const sorted = sortEntriesByWorldRanking(entries, worldRanking);
  const mid = Math.ceil(sorted.length / 2);
  const top = sorted.slice(0, mid);
  const bottom = sorted.slice(mid);
  const groups: Entry[][] = [
    top.map((item) => item.entry),
    bottom.map((item) => item.entry),
  ];
  const signature = `${baseClassId}:rankingTopBottom:${top
    .map((item) => `${item.entry.id}:${formatRankingPosition(item.position)}`)
    .join(',')}|${bottom
    .map((item) => `${item.entry.id}:${formatRankingPosition(item.position)}`)
    .join(',')}`;
  return { groups, signature };
};

const selectBalancedGroupIndices = (
  counts: number[],
  partCount: number,
  maxGroupSize: number,
): number[] => {
  if (partCount <= 0) {
    return [];
  }
  const withIndex = counts.map((count, index) => ({ count, index }));
  const available = withIndex.filter((item) => maxGroupSize === 0 || item.count < maxGroupSize);
  const candidates = available.length > 0 ? available : withIndex;
  const minCount = Math.min(...candidates.map((item) => item.count));
  return candidates
    .filter((item) => item.count === minCount)
    .map((item) => item.index)
    .sort((left, right) => left - right);
};

const createRankingBalancedSplit = (
  baseClassId: string,
  entries: Entry[],
  partCount: number,
  worldRanking?: WorldRankingMap,
): { groups: Entry[][]; signature: string } => {
  const sorted = sortEntriesByWorldRanking(entries, worldRanking);
  const ranked = sorted.filter((item) => item.position !== undefined);
  const unranked = sorted.filter((item) => item.position === undefined);
  const groups: Entry[][] = Array.from({ length: partCount }, () => [] as Entry[]);
  const scores: number[] = Array.from({ length: partCount }, () => 0);
  const counts: number[] = Array.from({ length: partCount }, () => 0);
  const totalEntries = entries.length;
  const maxGroupSize = partCount > 0 ? Math.ceil(totalEntries / partCount) : 0;

  ranked.forEach((item) => {
    const candidates = selectBalancedGroupIndices(counts, partCount, maxGroupSize);
    let bestIndex = candidates[0] ?? 0;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestCount = Number.POSITIVE_INFINITY;
    candidates.forEach((index) => {
      const score = scores[index];
      const count = counts[index];
      if (score < bestScore) {
        bestScore = score;
        bestCount = count;
        bestIndex = index;
        return;
      }
      if (score === bestScore) {
        if (count < bestCount) {
          bestCount = count;
          bestIndex = index;
          return;
        }
        if (count === bestCount && index < bestIndex) {
          bestIndex = index;
        }
      }
    });
    groups[bestIndex].push(item.entry);
    scores[bestIndex] += item.position ?? 0;
    counts[bestIndex] += 1;
  });

  unranked
    .map((item) => item.entry)
    .forEach((entry) => {
      const candidates = selectBalancedGroupIndices(counts, partCount, maxGroupSize);
      const bestIndex = candidates[0] ?? 0;
      groups[bestIndex].push(entry);
      counts[bestIndex] += 1;
    });

  const signature = `${baseClassId}:rankingBalanced:${groups
    .map((group, index) => {
      const detail = group
        .map((entry) =>
          `${entry.id}:${formatRankingPosition(
            entry.iofId ? worldRanking?.get(entry.iofId) : undefined,
          )}`,
        )
        .join(',');
      return `${index}:${detail}`;
    })
    .join('|')}`;

  return { groups, signature };
};

const distributeEntriesEvenly = (entries: Entry[], partCount: number): Entry[][] => {
  if (partCount <= 0) {
    return [];
  }
  const groups: Entry[][] = Array.from({ length: partCount }, () => [] as Entry[]);
  entries.forEach((entry, index) => {
    groups[index % partCount]?.push(entry);
  });
  const counts = groups.map((group) => group.length);
  const minCount = counts.length > 0 ? Math.min(...counts) : 0;
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
  if (maxCount - minCount > 1) {
    const baseCount = Math.floor(entries.length / partCount);
    const remainder = entries.length % partCount;
    let index = 0;
    groups.forEach((group, groupIndex) => {
      group.length = 0;
      const targetSize = baseCount + (groupIndex < remainder ? 1 : 0);
      for (let offset = 0; offset < targetSize; offset += 1) {
        const entry = entries[index];
        if (entry) {
          group.push(entry);
        }
        index += 1;
      }
    });
  }
  return groups;
};

interface DeterministicShuffleResult<T> {
  entries: T[];
  seed: string;
  orderSignature: string;
}

const createDeterministicShuffle = <T extends { id: string }>(
  entries: T[],
  baseClassId: string,
): DeterministicShuffleResult<T> => {
  const normalized = [...entries].sort((left, right) => left.id.localeCompare(right.id, 'ja'));
  const seedBase = normalized.map((entry) => `${baseClassId}#${entry.id}`).join('|');
  const seed = hashString(`split-random#${seedBase}`);
  const numericSeed = Number.parseInt(seed, 16);
  const random = mulberry32(Number.isNaN(numericSeed) || numericSeed === 0 ? MIN_RANDOM_SEED : numericSeed);
  const shuffledIndices = shuffleWithRandom(
    normalized.map((_, index) => index),
    random,
  );
  const shuffledEntries = shuffledIndices.map((index) => normalized[index]);
  const orderSignature = shuffledEntries.map((entry) => entry.id).join(',');
  return { entries: shuffledEntries, seed, orderSignature };
};

export interface ClassSplitPreparation {
  signature: string;
  groups: ClassGroup[];
  entryToSplitId: Map<string, string>;
  splitIdToBaseClassId: Map<string, string>;
  splitIdToEntryIds: Map<string, string[]>;
  result?: ClassSplitResult;
}

export interface ClassSplitOptions {
  splitRules?: ClassSplitRules;
  previousSplitResult?: ClassSplitResult;
  startOrderRules?: StartOrderRules;
  worldRankingByClass?: WorldRankingByClass;
}

export type GenerateLaneAssignmentsOptions = ClassSplitOptions;

export interface GenerateLaneAssignmentsResult {
  assignments: LaneAssignmentDto[];
  splitResult?: ClassSplitResult;
  splitSignature: string;
}

export const prepareClassSplits = (
  entries: Entry[],
  options: ClassSplitOptions = {},
): ClassSplitPreparation => {
  const grouped = groupEntriesByClass(entries);
  const normalizedRules = (options.splitRules ?? [])
    .filter((rule) => rule.partCount && rule.partCount > 1)
    .map((rule) => ({
      ...rule,
      baseClassId: rule.baseClassId.trim(),
      partCount:
        rule.method === 'rankingTopBottom'
          ? 2
          : Math.max(2, Math.floor(rule.partCount)),
    }));
  const startOrderMethodMap = createStartOrderMethodMap(options.startOrderRules);
  const worldRankingByClass = options.worldRankingByClass;
  const rulesByBase = new Map<string, (typeof normalizedRules)[number]>();
  normalizedRules.forEach((rule) => {
    rulesByBase.set(rule.baseClassId, rule);
  });

  const allBaseIds = new Set<string>([...grouped.keys(), ...rulesByBase.keys()]);
  const baseIds = Array.from(allBaseIds).sort((a, b) => a.localeCompare(b, 'ja'));

  const groups: ClassGroup[] = [];
  const entryToSplitId = new Map<string, string>();
  const splitIdToBaseClassId = new Map<string, string>();
  const splitIdToEntryIds = new Map<string, string[]>();
  const baseEntryIds = new Map<string, string[]>();
  const shuffleMetadata: string[] = [];
  const rankingMetadata: string[] = [];

  baseIds.forEach((baseClassId) => {
    const entriesForClass = grouped.get(baseClassId) ?? [];
    const rule = rulesByBase.get(baseClassId);
    if (!rule) {
      const entryIds = entriesForClass.map((entry) => {
        entryToSplitId.set(entry.id, baseClassId);
        return entry.id;
      });
      splitIdToBaseClassId.set(baseClassId, baseClassId);
      splitIdToEntryIds.set(baseClassId, entryIds);
      baseEntryIds.set(baseClassId, entryIds);
      groups.push({ classId: baseClassId, baseClassId, entries: entriesForClass });
      return;
    }

    const partCount = rule.partCount;
    const splitGroups = Array.from({ length: partCount }, (_, index) => {
      const suffix = createSplitSuffix(index);
      const splitId = `${baseClassId}${suffix}`;
      splitIdToBaseClassId.set(splitId, baseClassId);
      const entryIds: string[] = [];
      splitIdToEntryIds.set(splitId, entryIds);
      return {
        group: { classId: splitId, baseClassId, entries: [] as Entry[] },
        entryIds,
      };
    });

    const startOrderMethod = startOrderMethodMap.get(baseClassId);
    const worldRanking = worldRankingByClass?.get(baseClassId);
    const hasWorldRanking = worldRanking && worldRanking.size > 0;
    const canUseRanking =
      rule.method !== 'random' && startOrderMethod === 'worldRanking' && hasWorldRanking && entriesForClass.length > 0;

    let baseOrder = entriesForClass;

    if (canUseRanking) {
      const { groups: rankingGroups, signature: rankingSignature } =
        rule.method === 'rankingTopBottom'
          ? createRankingTopBottomSplit(baseClassId, entriesForClass, worldRanking)
          : createRankingBalancedSplit(baseClassId, entriesForClass, partCount, worldRanking);
      rankingMetadata.push(rankingSignature);
      baseOrder = rankingGroups.flat();
      rankingGroups.forEach((entriesForGroup, groupIndex) => {
        const target = splitGroups[groupIndex];
        entriesForGroup.forEach((entry) => {
          if (!target) {
            return;
          }
          target.group.entries.push(entry);
          target.entryIds.push(entry.id);
          entryToSplitId.set(entry.id, target.group.classId);
        });
      });
    } else {
      if (rule.method !== 'random') {
        let reason = 'unknown';
        if (startOrderMethod !== 'worldRanking') {
          reason = 'start-order';
        } else if (!hasWorldRanking) {
          reason = 'ranking-data';
        } else if (entriesForClass.length <= 1) {
          reason = 'entries';
        }
        rankingMetadata.push(`${baseClassId}:fallback:${rule.method}:${reason}`);
      }
      if (entriesForClass.length > 1) {
        const { entries: shuffled, seed, orderSignature } = createDeterministicShuffle(entriesForClass, baseClassId);
        baseOrder = shuffled;
        shuffleMetadata.push(`${baseClassId}:${seed}:${orderSignature}`);
      }
      const distributed = distributeEntriesEvenly(baseOrder, partCount);
      distributed.forEach((entriesForGroup, groupIndex) => {
        const target = splitGroups[groupIndex];
        entriesForGroup.forEach((entry) => {
          if (!target) {
            return;
          }
          target.group.entries.push(entry);
          target.entryIds.push(entry.id);
          entryToSplitId.set(entry.id, target.group.classId);
        });
      });
    }

    baseEntryIds.set(baseClassId, baseOrder.map((entry) => entry.id));

    splitGroups.forEach(({ group }) => {
      groups.push(group);
    });
  });

  baseEntryIds.forEach((entryIds, baseClassId) => {
    splitIdToEntryIds.set(baseClassId, entryIds);
    if (!splitIdToBaseClassId.has(baseClassId)) {
      splitIdToBaseClassId.set(baseClassId, baseClassId);
    }
  });

  const hasSplits = normalizedRules.length > 0;
  const splitClasses = normalizedRules.flatMap((rule) =>
    Array.from({ length: rule.partCount }, (_, index) => ({
      classId: `${rule.baseClassId}${createSplitSuffix(index)}`,
      baseClassId: rule.baseClassId,
      splitIndex: index,
      displayName: createSplitDisplayName(rule.method, index),
    })),
  );

  const ruleSignatureParts = normalizedRules
    .map((rule) => `${rule.baseClassId}:${rule.partCount}:${rule.method}`)
    .sort((a, b) => a.localeCompare(b, 'ja'));
  const shuffleSignatureParts = shuffleMetadata.sort((a, b) => a.localeCompare(b, 'ja'));
  const distributionParts = groups
    .map((group) => `${group.classId}:${group.baseClassId}:${group.entries.map((entry) => entry.id).join(',')}`)
    .sort((a, b) => a.localeCompare(b, 'ja'));
  const rankingSignatureParts = rankingMetadata.sort((a, b) => a.localeCompare(b, 'ja'));
  const worldRankingSignature = createWorldRankingByClassSignature(worldRankingByClass);
  const signatureBase = [
    ...ruleSignatureParts,
    ...shuffleSignatureParts,
    ...distributionParts,
    ...rankingSignatureParts,
    worldRankingSignature,
  ]
    .filter((part) => part.length > 0)
    .join('|');
  const signature = hasSplits ? hashString(`split#${signatureBase}`) : 'no-split';

  const computedResult = hasSplits
    ? {
        signature,
        splitClasses,
        entryToSplitId: new Map(entryToSplitId),
        splitIdToEntryIds: new Map(splitIdToEntryIds),
      }
    : undefined;

  return {
    signature,
    groups,
    entryToSplitId,
    splitIdToBaseClassId,
    splitIdToEntryIds,
    result: computedResult,
  };
};

export const generateLaneAssignments = (
  entries: Entry[],
  laneCount: number,
  laneIntervalMs: number,
  options: GenerateLaneAssignmentsOptions = {},
): GenerateLaneAssignmentsResult => {
  const preparation = prepareClassSplits(entries, options);
  if (!laneCount || laneCount <= 0 || laneIntervalMs < 0) {
    return { assignments: [], splitResult: preparation.result, splitSignature: preparation.signature };
  }
  const groups = preparation.groups.filter((group) => group.entries.length > 0);
  if (groups.length === 0) {
    return { assignments: [], splitResult: preparation.result, splitSignature: preparation.signature };
  }

  const lanes = Array.from({ length: laneCount }, (_, index) => ({
    laneNumber: index + 1,
    classOrder: [] as string[],
    load: 0,
  }));

  const sortedGroups = groups.sort((a, b) => {
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

  const assignments = lanes
    .filter((lane) => lane.classOrder.length > 0)
    .sort((a, b) => a.laneNumber - b.laneNumber)
    .map<LaneAssignmentDto>((lane) => ({
      laneNumber: lane.laneNumber,
      classOrder: lane.classOrder,
      interval: { milliseconds: laneIntervalMs },
    }));

  return { assignments, splitResult: preparation.result, splitSignature: preparation.signature };
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
  startOrderRules?: StartOrderRules;
  worldRankingByClass?: WorldRankingByClass;
  splitRules?: ClassSplitRules;
  previousSplitResult?: ClassSplitResult;
}

export interface CreateDefaultClassAssignmentsResult {
  assignments: ClassAssignmentDto[];
  seed: string;
  warnings: ClassOrderWarning[];
  splitResult?: ClassSplitResult;
  splitSignature: string;
}

export const createDefaultClassAssignments = ({
  entries,
  playerIntervalMs,
  seed,
  startlistId,
  laneAssignments,
  policy = seededRandomClassOrderPolicy,
  startOrderRules,
  worldRankingByClass,
  splitRules,
  previousSplitResult,
}: CreateDefaultClassAssignmentsOptions): CreateDefaultClassAssignmentsResult => {
  const preparation = prepareClassSplits(entries, {
    splitRules,
    previousSplitResult,
    startOrderRules,
    worldRankingByClass,
  });
  const groups = preparation.groups.filter((group) => group.entries.length > 0);
  const derivedSeed = policy.deriveSeed({
    seed,
    startlistId,
    entries,
    laneAssignments,
    startOrderRules,
    worldRankingByClass,
    classSplitSignature: preparation.signature,
  });
  const { playerOrders, warnings } = policy.execute({
    groups,
    seed: derivedSeed,
    startOrderRules,
    worldRankingByClass,
  });
  return {
    assignments: createClassAssignmentsFromOrders(groups, playerOrders, playerIntervalMs),
    seed: derivedSeed,
    warnings: Array.from(warnings.values()),
    splitResult: preparation.result,
    splitSignature: preparation.signature,
  };
};

export const deriveClassOrderWarnings = (
  assignments: ClassAssignmentDto[],
  entries: Entry[],
  options: ClassSplitOptions = {},
): ClassOrderWarning[] => {
  if (!assignments.length) {
    return [];
  }
  const preparation = prepareClassSplits(entries, options);
  const groups = preparation.groups.filter((group) => group.entries.length > 0);
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
  splitRules?: ClassSplitRules;
  splitResult?: ClassSplitResult;
}

export const calculateStartTimes = ({
  settings,
  laneAssignments,
  classAssignments,
  entries,
  splitRules,
  splitResult,
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
  const preparation = prepareClassSplits(entries, { splitRules, previousSplitResult: splitResult });
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
      const fallbackEntries = () => {
        const direct = preparation.splitIdToEntryIds.get(classId);
        if (direct && direct.length > 0) {
          return direct;
        }
        const baseClassId = preparation.splitIdToBaseClassId.get(classId) ?? classId;
        if (baseClassId !== classId) {
          const splitBaseEntries = preparation.splitIdToEntryIds.get(baseClassId);
          if (splitBaseEntries && splitBaseEntries.length > 0) {
            return splitBaseEntries;
          }
        }
        return (groupedEntries.get(baseClassId) ?? groupedEntries.get(classId) ?? []).map((entry) => entry.id);
      };
      const playerOrder = assignment?.playerOrder?.length ? assignment.playerOrder : fallbackEntries();

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
