export const STARTLIST_BASE_PATH = '/startlist';
export const STARTLIST_VIEWER_BASE_PATH = '/startlists';

export const getStartlistViewerPath = (startlistId: string): string => {
  const encodedId = encodeURIComponent(startlistId);
  return `${STARTLIST_VIEWER_BASE_PATH}/${encodedId}`;
};

export const STARTLIST_STEP_PATHS = {
  input: `${STARTLIST_BASE_PATH}/input`,
  lanes: `${STARTLIST_BASE_PATH}/lanes`,
  order: `${STARTLIST_BASE_PATH}/order`,
  link: `${STARTLIST_BASE_PATH}/link`,
} as const;

export type StartlistStepKey = keyof typeof STARTLIST_STEP_PATHS;

export const STARTLIST_STEP_SEQUENCE: StartlistStepKey[] = ['input', 'lanes', 'order', 'link'];
