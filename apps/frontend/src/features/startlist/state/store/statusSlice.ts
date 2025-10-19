import type { StatusKey, StatusMessageState } from '../types';

export interface StatusState {
  statuses: Record<StatusKey, StatusMessageState>;
  loading: Partial<Record<StatusKey, boolean>>;
}

export const statusKeys: StatusKey[] = [
  'settings',
  'entries',
  'lanes',
  'classes',
  'startTimes',
  'snapshot',
  'startOrder',
  'classSplit',
];

export const defaultStatus = (
  text = '待機中です。',
  level: StatusMessageState['level'] = 'idle',
): StatusMessageState => ({
  level,
  text,
});

export const createInitialStatusState = (): StatusState => ({
  statuses: statusKeys.reduce(
    (acc, key) => ({
      ...acc,
      [key]: defaultStatus(),
    }),
    {} as Record<StatusKey, StatusMessageState>,
  ),
  loading: {},
});

export type StatusAction =
  | { type: 'status/setStatus'; payload: { key: StatusKey; status: StatusMessageState } }
  | { type: 'status/setLoading'; payload: { key: StatusKey; value: boolean } };

export const statusReducer = (state: StatusState, action: StatusAction): StatusState => {
  switch (action.type) {
    case 'status/setStatus':
      return {
        ...state,
        statuses: {
          ...state.statuses,
          [action.payload.key]: action.payload.status,
        },
      };
    case 'status/setLoading':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value,
        },
      };
    default:
      return state;
  }
};

export const createStatus = (
  text: string,
  level: StatusMessageState['level'],
): StatusMessageState => ({
  level,
  text,
});
