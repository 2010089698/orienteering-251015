import type { Entry } from '../state/types';

export type InputStepTab = { id: string; label: string; count: number };

export interface InputStepViewModel {
  tabs: InputStepTab[];
  classIds: string[];
  activeTab: string;
  filteredEntries: Entry[];
}

export interface CreateInputStepViewModelOptions {
  entries: Entry[];
  activeTab: string;
}

export const createInputStepViewModel = ({
  entries,
  activeTab,
}: CreateInputStepViewModelOptions): InputStepViewModel => {
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    const key = entry.classId;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const classIds = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, 'ja'));

  const tabs: InputStepTab[] = [
    { id: 'all', label: 'すべて', count: entries.length },
    ...classIds.map((classId) => ({ id: classId, label: classId, count: counts.get(classId) ?? 0 })),
  ];

  const hasActiveTab = activeTab === 'all' || classIds.includes(activeTab);
  const effectiveActiveTab = hasActiveTab ? activeTab : 'all';
  const filteredEntries =
    effectiveActiveTab === 'all'
      ? entries
      : entries.filter((entry) => entry.classId === effectiveActiveTab);

  return {
    tabs,
    classIds,
    activeTab: effectiveActiveTab,
    filteredEntries,
  };
};
