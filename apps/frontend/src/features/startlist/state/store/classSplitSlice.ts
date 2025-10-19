import type { ClassSplitResult, ClassSplitRules } from '../types';

export interface ClassSplitState {
  classSplitRules: ClassSplitRules;
  classSplitResult?: ClassSplitResult;
}

export const initialClassSplitState: ClassSplitState = {
  classSplitRules: [],
  classSplitResult: undefined,
};

export type ClassSplitAction =
  | { type: 'classSplit/setRules'; payload: ClassSplitRules }
  | { type: 'classSplit/setResult'; payload: ClassSplitResult | undefined };

export const classSplitReducer = (
  state: ClassSplitState,
  action: ClassSplitAction,
): ClassSplitState => {
  switch (action.type) {
    case 'classSplit/setRules':
      return {
        ...state,
        classSplitRules: action.payload,
      };
    case 'classSplit/setResult':
      return {
        ...state,
        classSplitResult: action.payload,
      };
    default:
      return state;
  }
};

export const shouldResetForSplitChange = (
  current?: ClassSplitResult,
  next?: ClassSplitResult,
): boolean => {
  const currentSignature = current?.signature;
  const nextSignature = next?.signature;
  return currentSignature !== nextSignature;
};
