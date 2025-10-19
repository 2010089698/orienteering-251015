import type { LaneAssignmentDto } from '@startlist-management/application';
import type { ClassSplitResult, Entry } from '../state/types';

export type ClassSplitMetadata = {
  baseClassId: string;
  splitIndex?: number;
  partCount: number;
  displayName?: string;
  helperText?: string;
};

export type BuildClassSplitMetadataParams = {
  entries: Entry[];
  laneAssignments?: LaneAssignmentDto[];
  splitClasses?: ClassSplitResult['splitClasses'];
  splitIdToEntryIds?: Map<string, string[]>;
  splitIdToBaseClassId?: Map<string, string>;
};

export type BuildClassSplitMetadataResult = {
  metadataByClassId: Map<string, ClassSplitMetadata>;
  countsByClassId: Map<string, number>;
};

const createHelperText = (classId: string, meta: ClassSplitMetadata): string => {
  const parts: string[] = [];
  if (meta.baseClassId && meta.baseClassId !== classId) {
    parts.push(meta.baseClassId);
  }
  if (meta.partCount > 1) {
    const label = meta.displayName ? `分割 ${meta.displayName}` : '分割';
    const position = meta.splitIndex !== undefined ? `${meta.splitIndex + 1}/${meta.partCount}` : undefined;
    parts.push(position ? `${label} (${position})` : label);
  }
  return parts.join(' • ');
};

export const buildClassSplitMetadata = ({
  entries,
  laneAssignments = [],
  splitClasses,
  splitIdToEntryIds,
  splitIdToBaseClassId,
}: BuildClassSplitMetadataParams): BuildClassSplitMetadataResult => {
  const metadataByClassId = new Map<string, ClassSplitMetadata>();
  const countsByClassId = new Map<string, number>();
  const splitClassMeta = new Map<string, { baseClassId: string; splitIndex: number; displayName?: string }>();
  const basePartCounts = new Map<string, number>();

  splitClasses?.forEach((item) => {
    const baseClassId = item.baseClassId.trim();
    splitClassMeta.set(item.classId.trim(), {
      baseClassId,
      splitIndex: item.splitIndex,
      displayName: item.displayName,
    });
    basePartCounts.set(baseClassId, (basePartCounts.get(baseClassId) ?? 0) + 1);
  });

  if ((!splitClasses || splitClasses.length === 0) && splitIdToBaseClassId) {
    splitIdToBaseClassId.forEach((baseClassId, classId) => {
      const trimmedBase = baseClassId.trim();
      if (classId.trim() !== trimmedBase) {
        basePartCounts.set(trimmedBase, (basePartCounts.get(trimmedBase) ?? 0) + 1);
      }
    });
  }

  const ensureMetadata = (rawClassId: string) => {
    const classId = rawClassId.trim();
    if (!classId) {
      return;
    }
    if (!metadataByClassId.has(classId)) {
      const splitMeta = splitClassMeta.get(classId);
      const baseClassId = splitMeta?.baseClassId ?? splitIdToBaseClassId?.get(classId)?.trim() ?? classId;
      const partCount = basePartCounts.get(baseClassId) ?? 1;
      const meta: ClassSplitMetadata = {
        baseClassId,
        splitIndex: splitMeta?.splitIndex,
        partCount,
        displayName: splitMeta?.displayName,
      };
      const helperText = createHelperText(classId, meta);
      if (helperText) {
        meta.helperText = helperText;
      }
      metadataByClassId.set(classId, meta);
    }
    if (!countsByClassId.has(classId)) {
      countsByClassId.set(classId, 0);
    }
  };

  splitClasses?.forEach((item) => {
    ensureMetadata(item.classId);
    ensureMetadata(item.baseClassId);
  });

  splitIdToBaseClassId?.forEach((baseClassId, classId) => {
    ensureMetadata(classId);
    ensureMetadata(baseClassId);
  });

  const classesWithExplicitCounts = new Set<string>();
  splitIdToEntryIds?.forEach((ids, classId) => {
    ensureMetadata(classId);
    countsByClassId.set(classId.trim(), ids.length);
    classesWithExplicitCounts.add(classId.trim());
  });

  laneAssignments.forEach((lane) => {
    lane.classOrder.forEach((classId) => {
      ensureMetadata(classId);
    });
  });

  entries.forEach((entry) => {
    const classId = entry.classId.trim();
    ensureMetadata(classId);
    if (!classesWithExplicitCounts.has(classId)) {
      countsByClassId.set(classId, (countsByClassId.get(classId) ?? 0) + 1);
    }
  });

  metadataByClassId.forEach((_meta, classId) => {
    if (!countsByClassId.has(classId)) {
      countsByClassId.set(classId, 0);
    }
  });

  return { metadataByClassId, countsByClassId };
};
