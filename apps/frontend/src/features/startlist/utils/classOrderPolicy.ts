import type { ClassAssignmentDto, LaneAssignmentDto } from '@startlist-management/application';
import type {
  ClassOrderWarning,
  ClassOrderWarningOccurrence,
  Entry,
  WorldRankingMap,
  WorldRankingTargetClassIds,
} from '../state/types';

export interface ClassGroup {
  classId: string;
  entries: Entry[];
}

export interface ClassOrderPolicySeedInput {
  startlistId?: string;
  entries: Entry[];
  laneAssignments?: LaneAssignmentDto[];
  seed?: string;
  worldRanking?: WorldRankingMap;
  worldRankingTargetClassIds?: WorldRankingTargetClassIds;
}

export interface ClassOrderPolicyExecutionInput {
  groups: ClassGroup[];
  seed: string;
  worldRanking?: WorldRankingMap;
  worldRankingTargetClassIds?: WorldRankingTargetClassIds;
}

export interface ClassOrderPolicyExecutionResult {
  playerOrders: Map<string, string[]>;
  warnings: Map<string, ClassOrderWarning>;
}

export interface ClassOrderPolicy {
  readonly id: string;
  readonly label: string;
  deriveSeed(input: ClassOrderPolicySeedInput): string;
  execute(input: ClassOrderPolicyExecutionInput): ClassOrderPolicyExecutionResult;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const fnv1aHash = (value: string): number => {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
    hash >>>= 0;
  }
  return hash >>> 0;
};

const hashString = (value: string): string => {
  return fnv1aHash(value).toString(16).padStart(8, '0');
};

const stringToSeed = (seed: string): number => {
  if (!seed) {
    return 1;
  }
  const parsed = Number.parseInt(seed.replace(/[^0-9a-f]/gi, ''), 16);
  if (Number.isNaN(parsed) || parsed === 0) {
    return fnv1aHash(seed) || 1;
  }
  return parsed >>> 0;
};

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

const normalizeClubToken = (token: string): string => token.trim().replace(/\s+/g, ' ');

const createClubTokens = (club?: string): string[] => {
  if (!club) {
    return [];
  }
  const tokens = club
    .split('/')
    .map((part) => normalizeClubToken(part))
    .filter((part) => part.length > 0);
  return Array.from(new Set(tokens));
};

const shareClub = (left: Set<string>, right: Set<string>): boolean => {
  if (!left.size || !right.size) {
    return false;
  }
  for (const token of left) {
    if (right.has(token)) {
      return true;
    }
  }
  return false;
};

const sharedClubs = (left: Set<string>, right: Set<string>): string[] => {
  if (!left.size || !right.size) {
    return [];
  }
  const intersection: string[] = [];
  for (const token of left) {
    if (right.has(token)) {
      intersection.push(token);
    }
  }
  return intersection;
};

interface EntryWithClubs {
  entry: Entry;
  tokens: string[];
  tokenSet: Set<string>;
}

const prepareGroupEntries = (group: ClassGroup): EntryWithClubs[] => {
  return group.entries.map((entry) => {
    const tokens = createClubTokens(entry.club);
    return {
      entry,
      tokens,
      tokenSet: new Set(tokens),
    };
  });
};

const findConflictFreeOrder = (items: EntryWithClubs[], random: () => number): number[] | undefined => {
  const count = items.length;
  if (count <= 1) {
    return items.map((_, index) => index);
  }

  const allIndices = items.map((_, index) => index);
  const startOrder = shuffleWithRandom(allIndices, random);
  const visited = new Array<boolean>(count).fill(false);
  const order = new Array<number>(count).fill(-1);

  const dfs = (position: number, lastIndex: number): boolean => {
    if (position === count) {
      return true;
    }

    const lastSet = lastIndex >= 0 ? items[lastIndex].tokenSet : new Set<string>();
    const safeIndices: number[] = [];

    for (let index = 0; index < count; index += 1) {
      if (visited[index]) {
        continue;
      }
      if (!shareClub(lastSet, items[index].tokenSet)) {
        safeIndices.push(index);
      }
    }

    if (safeIndices.length === 0) {
      return false;
    }

    const shuffled = shuffleWithRandom(safeIndices, random);
    for (const candidate of shuffled) {
      visited[candidate] = true;
      order[position] = candidate;
      if (dfs(position + 1, candidate)) {
        return true;
      }
      visited[candidate] = false;
    }
    return false;
  };

  for (const startIndex of startOrder) {
    visited.fill(false);
    visited[startIndex] = true;
    order[0] = startIndex;
    if (dfs(1, startIndex)) {
      return order.slice(0, count);
    }
  }

  return undefined;
};

const countSharedClubs = (left: Set<string>, right: Set<string>): number => sharedClubs(left, right).length;

const buildOrderWithMinimalConflicts = (items: EntryWithClubs[], random: () => number): number[] => {
  const remaining = items.map((_, index) => index);
  const order: number[] = [];
  let lastIndex = -1;

  while (remaining.length > 0) {
    const lastSet = lastIndex >= 0 ? items[lastIndex].tokenSet : new Set<string>();
    const safeCandidates = remaining.filter((index) => !shareClub(lastSet, items[index].tokenSet));

    if (safeCandidates.length > 0) {
      const [selected] = shuffleWithRandom(safeCandidates, random);
      order.push(selected);
      remaining.splice(remaining.indexOf(selected), 1);
      lastIndex = selected;
      continue;
    }

    const scored = remaining.map((index) => ({
      index,
      overlap: countSharedClubs(lastSet, items[index].tokenSet),
      richness: items[index].tokenSet.size,
      tieBreaker: random(),
    }));

    scored.sort((a, b) => {
      if (a.overlap !== b.overlap) {
        return a.overlap - b.overlap;
      }
      if (a.richness !== b.richness) {
        return a.richness - b.richness;
      }
      return a.tieBreaker - b.tieBreaker;
    });

    const selected = scored[0]?.index ?? remaining[0];
    order.push(selected);
    remaining.splice(remaining.indexOf(selected), 1);
    lastIndex = selected;
  }

  return order;
};

const createOrderFromIndices = (group: ClassGroup, indices: number[]): string[] => {
  return indices.map((index) => group.entries[index]?.id).filter((id): id is string => Boolean(id));
};

const createWorldRankingOrder = (
  group: ClassGroup,
  random: () => number,
  worldRanking?: WorldRankingMap,
): string[] | undefined => {
  if (!worldRanking || worldRanking.size === 0) {
    return undefined;
  }

  const ranked: { entry: Entry; position: number }[] = [];
  const unranked: Entry[] = [];

  group.entries.forEach((entry) => {
    if (!entry.iofId) {
      unranked.push(entry);
      return;
    }
    const position = worldRanking.get(entry.iofId);
    if (position === undefined) {
      unranked.push(entry);
      return;
    }
    ranked.push({ entry, position });
  });

  if (ranked.length === 0) {
    return undefined;
  }

  const unrankedOrder = shuffleWithRandom(unranked, random).map((entry) => entry.id);
  const rankedWithTieBreaker = ranked.map(({ entry, position }) => ({
    entry,
    position,
    tieBreaker: random(),
  }));

  rankedWithTieBreaker.sort((left, right) => {
    if (left.position !== right.position) {
      return right.position - left.position;
    }
    if (left.tieBreaker !== right.tieBreaker) {
      return left.tieBreaker - right.tieBreaker;
    }
    return left.entry.id.localeCompare(right.entry.id, 'ja');
  });

  const rankedOrder = rankedWithTieBreaker.map(({ entry }) => entry.id);
  return [...unrankedOrder, ...rankedOrder];
};

export const calculateClassOrderWarnings = (
  groups: ClassGroup[],
  playerOrders: Map<string, string[]>,
): Map<string, ClassOrderWarning> => {
  const warnings = new Map<string, ClassOrderWarning>();

  groups.forEach((group) => {
    if (group.entries.length <= 1) {
      return;
    }

    const entryInfo = new Map<string, EntryWithClubs>();
    group.entries.forEach((entry) => {
      const tokens = createClubTokens(entry.club);
      entryInfo.set(entry.id, {
        entry,
        tokens,
        tokenSet: new Set(tokens),
      });
    });

    const order = playerOrders.get(group.classId) ?? group.entries.map((entry) => entry.id);
    const occurrences: ClassOrderWarningOccurrence[] = [];

    for (let index = 1; index < order.length; index += 1) {
      const prevId = order[index - 1];
      const currentId = order[index];
      const prev = entryInfo.get(prevId);
      const current = entryInfo.get(currentId);
      if (!prev || !current) {
        continue;
      }
      const overlap = sharedClubs(prev.tokenSet, current.tokenSet);
      if (overlap.length > 0) {
        occurrences.push({ previousPlayerId: prev.entry.id, nextPlayerId: current.entry.id, clubs: overlap });
      }
    }

    if (occurrences.length > 0) {
      warnings.set(group.classId, { classId: group.classId, occurrences });
    }
  });

  return warnings;
};

const createLaneSignature = (laneAssignments: LaneAssignmentDto[] = []): string => {
  return laneAssignments
    .slice()
    .sort((a, b) => a.laneNumber - b.laneNumber)
    .map((lane) => {
      const interval = lane.interval?.milliseconds ?? 0;
      return `${lane.laneNumber}:${interval}:${lane.classOrder.join('|')}`;
    })
    .join(';');
};

const createEntrySignature = (entries: Entry[]): string => {
  return entries
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => `${entry.id}:${entry.cardNo ?? ''}`)
    .join(';');
};

const createWorldRankingSignature = (
  worldRanking?: WorldRankingMap,
  targetClassIds?: WorldRankingTargetClassIds,
): string => {
  const rankingPart = worldRanking
    ? Array.from(worldRanking.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iofId, position]) => `${iofId}:${position}`)
        .join('|')
    : '';
  const targetPart = targetClassIds
    ? Array.from(targetClassIds.values())
        .sort((a, b) => a.localeCompare(b, 'ja'))
        .join('|')
    : '';
  return [rankingPart, targetPart].filter(Boolean).join('#');
};

export const deriveSeededRandomClassOrderSeed = ({
  startlistId,
  entries,
  laneAssignments,
  seed,
  worldRanking,
  worldRankingTargetClassIds,
}: ClassOrderPolicySeedInput): string => {
  if (seed) {
    return seed;
  }
  const base = [
    startlistId ?? 'startlist',
    createLaneSignature(laneAssignments),
    createEntrySignature(entries),
    createWorldRankingSignature(worldRanking, worldRankingTargetClassIds),
  ]
    .filter(Boolean)
    .join('#');
  return hashString(base || 'seeded-random');
};

const createSeededRandomClassOrderPolicy = (options: { avoidConsecutiveClubs: boolean }): ClassOrderPolicy => ({
  id: options.avoidConsecutiveClubs ? 'seeded-random-entry-order' : 'seeded-random-entry-order-unconstrained',
  label: options.avoidConsecutiveClubs ? 'エントリー順ランダム（所属考慮）' : 'エントリー順ランダム',
  deriveSeed: deriveSeededRandomClassOrderSeed,
  execute: ({
    groups,
    seed,
    worldRanking,
    worldRankingTargetClassIds,
  }: ClassOrderPolicyExecutionInput): ClassOrderPolicyExecutionResult => {
    const numericSeed = stringToSeed(seed);
    const random = mulberry32(numericSeed);
    const playerOrders = new Map<string, string[]>();

    groups.forEach((group) => {
      if (group.entries.length === 0) {
        playerOrders.set(group.classId, []);
        return;
      }

      if (worldRankingTargetClassIds?.has(group.classId)) {
        const rankingOrder = createWorldRankingOrder(group, random, worldRanking);
        if (rankingOrder) {
          playerOrders.set(group.classId, rankingOrder);
          return;
        }
      }

      if (!options.avoidConsecutiveClubs) {
        const shuffled = shuffleWithRandom(group.entries, random).map((entry) => entry.id);
        playerOrders.set(group.classId, shuffled);
        return;
      }

      const prepared = prepareGroupEntries(group);
      const zeroConflict = findConflictFreeOrder(prepared, random);
      const indices = zeroConflict ?? buildOrderWithMinimalConflicts(prepared, random);
      playerOrders.set(group.classId, createOrderFromIndices(group, indices));
    });

    const warnings = options.avoidConsecutiveClubs
      ? calculateClassOrderWarnings(groups, playerOrders)
      : new Map<string, ClassOrderWarning>();

    return { playerOrders, warnings };
  },
});

export const seededRandomClassOrderPolicy = createSeededRandomClassOrderPolicy({ avoidConsecutiveClubs: true });

export const seededRandomUnconstrainedClassOrderPolicy = createSeededRandomClassOrderPolicy({
  avoidConsecutiveClubs: false,
});

export const createClassAssignmentsFromOrders = (
  groups: ClassGroup[],
  playerOrders: Map<string, string[]>,
  intervalMs: number,
): ClassAssignmentDto[] => {
  return groups.map((group) => ({
    classId: group.classId,
    playerOrder: playerOrders.get(group.classId) ?? group.entries.map((entry) => entry.id),
    interval: { milliseconds: intervalMs },
  }));
};

