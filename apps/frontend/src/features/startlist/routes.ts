export const STARTLIST_BASE_PATH = '/startlist';

export const STARTLIST_STEP_PATHS = {
  input: `${STARTLIST_BASE_PATH}/input`,
  lanes: `${STARTLIST_BASE_PATH}/lanes`,
  order: `${STARTLIST_BASE_PATH}/order`,
} as const;

export type StartlistStepKey = keyof typeof STARTLIST_STEP_PATHS;

export const STARTLIST_STEP_SEQUENCE: StartlistStepKey[] = ['input', 'lanes', 'order'];
