const statusLabels: Record<string, string> = {
  DRAFT: '下書き',
  SETTINGS_ENTERED: '設定入力済み',
  LANE_ORDER_ASSIGNED: 'レーン確定済み',
  PLAYER_ORDER_ASSIGNED: 'クラス順確定',
  START_TIMES_ASSIGNED: 'スタート時刻確定',
  FINALIZED: '公開済み',
};

export const getStartlistStatusLabel = (status?: string): string | null => {
  if (!status) {
    return null;
  }
  return statusLabels[status] ?? status;
};
