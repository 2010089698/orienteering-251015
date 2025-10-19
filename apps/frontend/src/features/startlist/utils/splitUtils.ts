import type { ClassAssignmentDto } from '@startlist-management/application';
import type { ClassSplitResult, Entry } from '../state/types';

type MapLike<K, V> = Map<K, V> | [K, V][];

const toMap = <K, V>(value?: MapLike<K, V>): Map<K, V> => {
  if (!value) {
    return new Map<K, V>();
  }
  if (value instanceof Map) {
    return value;
  }
  return new Map<K, V>(value);
};

export interface SplitClassMetadataView {
  classId: string;
  baseClassId: string;
  displayName?: string;
}

export interface SplitClassLookup {
  playerToClassId: Map<string, string>;
  baseToClassIds: Map<string, string[]>;
  getPlayerClassId: (playerId: string) => string | undefined;
  getPlayerBaseClassId: (playerId: string) => string | undefined;
  getClassMetadata: (classId: string) => SplitClassMetadataView;
  getBaseClassId: (classId: string) => string;
  formatClassLabel: (classId: string) => string;
}

export const createSplitClassLookup = ({
  classAssignments,
  splitResult,
  entries,
}: {
  classAssignments: ClassAssignmentDto[];
  splitResult?: ClassSplitResult;
  entries: Entry[];
}): SplitClassLookup => {
  const entryBaseClassMap = new Map(entries.map((entry) => [entry.id, entry.classId]));
  const playerToClassId = new Map<string, string>();
  const classMetadata = new Map<string, SplitClassMetadataView>();

  classAssignments.forEach((assignment) => {
    assignment.playerOrder.forEach((playerId) => {
      if (!playerToClassId.has(playerId)) {
        playerToClassId.set(playerId, assignment.classId);
      }
    });
    if (!classMetadata.has(assignment.classId)) {
      const baseCandidate = assignment.playerOrder
        .map((playerId) => entryBaseClassMap.get(playerId))
        .find((value): value is string => Boolean(value));
      classMetadata.set(assignment.classId, {
        classId: assignment.classId,
        baseClassId: baseCandidate ?? assignment.classId,
      });
    }
  });

  const splitMeta = new Map<string, SplitClassMetadataView>();
  if (splitResult) {
    splitResult.splitClasses.forEach((meta) => {
      splitMeta.set(meta.classId, {
        classId: meta.classId,
        baseClassId: meta.baseClassId,
        displayName: meta.displayName,
      });
    });

    const entryToSplitId = toMap(splitResult.entryToSplitId);
    entryToSplitId.forEach((splitId, entryId) => {
      if (!playerToClassId.has(entryId)) {
        playerToClassId.set(entryId, splitId);
      }
      if (!classMetadata.has(splitId)) {
        const meta = splitMeta.get(splitId);
        classMetadata.set(splitId, {
          classId: splitId,
          baseClassId: meta?.baseClassId ?? entryBaseClassMap.get(entryId) ?? splitId,
          displayName: meta?.displayName,
        });
      } else {
        const existing = classMetadata.get(splitId)!;
        if (!existing.displayName) {
          existing.displayName = splitMeta.get(splitId)?.displayName;
        }
        if (!existing.baseClassId && splitMeta.has(splitId)) {
          existing.baseClassId = splitMeta.get(splitId)!.baseClassId;
        }
      }
    });
  }

  entries.forEach((entry) => {
    if (!playerToClassId.has(entry.id)) {
      playerToClassId.set(entry.id, entry.classId);
    }
    if (!classMetadata.has(entry.classId)) {
      classMetadata.set(entry.classId, {
        classId: entry.classId,
        baseClassId: entry.classId,
      });
    }
  });

  classMetadata.forEach((meta, classId) => {
    if (!meta.baseClassId) {
      meta.baseClassId = splitMeta.get(classId)?.baseClassId ?? classId;
    }
    if (!meta.displayName) {
      meta.displayName = splitMeta.get(classId)?.displayName;
    }
  });

  const baseToClassIds = new Map<string, string[]>();
  classMetadata.forEach((meta, classId) => {
    const baseClassId = meta.baseClassId ?? classId;
    if (!baseToClassIds.has(baseClassId)) {
      baseToClassIds.set(baseClassId, []);
    }
    const list = baseToClassIds.get(baseClassId)!;
    if (!list.includes(classId)) {
      list.push(classId);
    }
  });
  baseToClassIds.forEach((list) => {
    list.sort((a, b) => a.localeCompare(b, 'ja'));
  });

  const getClassMetadata = (classId: string): SplitClassMetadataView => {
    return classMetadata.get(classId) ?? { classId, baseClassId: classId };
  };

  const getBaseClassId = (classId: string): string => {
    return getClassMetadata(classId).baseClassId ?? classId;
  };

  const getPlayerClassId = (playerId: string): string | undefined => {
    return playerToClassId.get(playerId);
  };

  const getPlayerBaseClassId = (playerId: string): string | undefined => {
    const classId = getPlayerClassId(playerId) ?? entryBaseClassMap.get(playerId);
    if (!classId) {
      return undefined;
    }
    return getBaseClassId(classId);
  };

  const formatClassLabel = (classId: string): string => {
    const meta = getClassMetadata(classId);
    if (!meta || meta.baseClassId === classId) {
      return classId;
    }
    const helperParts = [meta.baseClassId];
    if (meta.displayName) {
      helperParts.push(`分割 ${meta.displayName}`);
    }
    return `${classId}（${helperParts.join('・')}）`;
  };

  return {
    playerToClassId,
    baseToClassIds,
    getPlayerClassId,
    getPlayerBaseClassId,
    getClassMetadata,
    getBaseClassId,
    formatClassLabel,
  };
};
