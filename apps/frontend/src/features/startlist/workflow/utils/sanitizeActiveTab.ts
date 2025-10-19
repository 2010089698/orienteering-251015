export type TabLike = { id: string };

export const sanitizeActiveTab = <T extends TabLike>(
  tabs: T[],
  activeTab: string,
  fallback: string,
): string => {
  if (activeTab === fallback) {
    return activeTab;
  }
  return tabs.some((tab) => tab.id === activeTab) ? activeTab : fallback;
};
