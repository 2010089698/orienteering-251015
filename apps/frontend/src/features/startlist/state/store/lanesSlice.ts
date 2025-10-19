import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
} from '@startlist-management/application';
import { deriveSeededRandomClassOrderSeed } from '../../utils/classOrderPolicy';
import type { ClassOrderWarning, Entry } from '../types';

export interface LanesState {
  laneAssignments: LaneAssignmentDto[];
  classAssignments: ClassAssignmentDto[];
  classOrderSeed?: string;
  classOrderWarnings: ClassOrderWarning[];
  startTimes: StartTimeDto[];
}

export const initialLanesState: LanesState = {
  laneAssignments: [],
  classAssignments: [],
  classOrderSeed: undefined,
  classOrderWarnings: [],
  startTimes: [],
};

export interface LanesReducerContext {
  startlistId: string;
  entries: Entry[];
}

export type LanesAction =
  | { type: 'lanes/setLaneAssignments'; payload: LaneAssignmentDto[] }
  | {
      type: 'lanes/setClassAssignments';
      payload: { assignments: ClassAssignmentDto[]; seed?: string; warnings?: ClassOrderWarning[] };
    }
  | { type: 'lanes/setStartTimes'; payload: StartTimeDto[] };

export const lanesReducer = (
  state: LanesState,
  action: LanesAction,
  context?: LanesReducerContext,
): LanesState => {
  switch (action.type) {
    case 'lanes/setLaneAssignments': {
      if (!context) {
        throw new Error('lanes/setLaneAssignments requires reducer context.');
      }

      if (!state.classAssignments.length || !state.classOrderSeed) {
        return {
          ...state,
          laneAssignments: action.payload,
        };
      }

      const derivedSeed = deriveSeededRandomClassOrderSeed({
        startlistId: context.startlistId,
        entries: context.entries,
        laneAssignments: action.payload,
      });

      if (derivedSeed === state.classOrderSeed) {
        return {
          ...state,
          laneAssignments: action.payload,
        };
      }

      return {
        ...state,
        laneAssignments: action.payload,
        classAssignments: [],
        classOrderSeed: undefined,
        classOrderWarnings: [],
      };
    }
    case 'lanes/setClassAssignments':
      return {
        ...state,
        classAssignments: action.payload.assignments,
        classOrderSeed: action.payload.seed ?? state.classOrderSeed,
        classOrderWarnings: action.payload.warnings ?? [],
      };
    case 'lanes/setStartTimes':
      return {
        ...state,
        startTimes: action.payload,
      };
    default:
      return state;
  }
};

export const createLaneAssignmentAction = (
  assignments: LaneAssignmentDto[],
): LanesAction => ({
  type: 'lanes/setLaneAssignments',
  payload: assignments,
});
