import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
  StartlistSnapshot,
  StartlistStatus,
} from '@startlist-management/domain';

export interface StartlistDiffValue<T> {
  previous?: T;
  current?: T;
}

export interface StartlistDiffChanges {
  settings?: StartlistDiffValue<StartlistSettingsDto>;
  laneAssignments?: StartlistDiffValue<LaneAssignmentDto[]>;
  classAssignments?: StartlistDiffValue<ClassAssignmentDto[]>;
  startTimes?: StartlistDiffValue<StartTimeDto[]>;
  status?: StartlistDiffValue<StartlistStatus>;
}

const isEqual = <T>(left: T | undefined, right: T | undefined): boolean => {
  if (left === right) {
    return true;
  }
  if (left === undefined || right === undefined) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
};

const cloneSettings = (settings: StartlistSettingsDto): StartlistSettingsDto => ({
  eventId: settings.eventId,
  startTime: settings.startTime,
  laneCount: settings.laneCount,
  intervals: {
    laneClass: { milliseconds: settings.intervals.laneClass.milliseconds },
    classPlayer: { milliseconds: settings.intervals.classPlayer.milliseconds },
  },
});

const cloneLaneAssignments = (assignments: LaneAssignmentDto[]): LaneAssignmentDto[] =>
  assignments.map((assignment) => ({
    laneNumber: assignment.laneNumber,
    classOrder: [...assignment.classOrder],
    interval: { milliseconds: assignment.interval.milliseconds },
  }));

const cloneClassAssignments = (assignments: ClassAssignmentDto[]): ClassAssignmentDto[] =>
  assignments.map((assignment) => ({
    classId: assignment.classId,
    playerOrder: [...assignment.playerOrder],
    interval: { milliseconds: assignment.interval.milliseconds },
  }));

const cloneStartTimes = (startTimes: StartTimeDto[]): StartTimeDto[] =>
  startTimes.map((startTime) => ({
    playerId: startTime.playerId,
    startTime: startTime.startTime,
    laneNumber: startTime.laneNumber,
  }));

const assignIfChanged = <T>(
  changes: StartlistDiffChanges,
  key: keyof StartlistDiffChanges,
  previousValue: T | undefined,
  currentValue: T | undefined,
  clone: (value: T) => T,
): void => {
  if (isEqual(previousValue, currentValue)) {
    return;
  }

  const diffValue: StartlistDiffValue<T> = {};
  if (previousValue !== undefined) {
    diffValue.previous = clone(previousValue);
  }
  if (currentValue !== undefined) {
    diffValue.current = clone(currentValue);
  }
  if (Object.keys(diffValue).length > 0) {
    changes[key] = diffValue as StartlistDiffValue<any>;
  }
};

export const diffStartlistSnapshots = (
  previous: StartlistSnapshot | undefined,
  current: StartlistSnapshot,
): StartlistDiffChanges => {
  const changes: StartlistDiffChanges = {};

  assignIfChanged(changes, 'settings', previous?.settings, current.settings, cloneSettings);
  assignIfChanged(
    changes,
    'laneAssignments',
    previous?.laneAssignments,
    current.laneAssignments,
    cloneLaneAssignments,
  );
  assignIfChanged(
    changes,
    'classAssignments',
    previous?.classAssignments,
    current.classAssignments,
    cloneClassAssignments,
  );
  assignIfChanged(changes, 'startTimes', previous?.startTimes, current.startTimes, cloneStartTimes);
  assignIfChanged(changes, 'status', previous?.status, current.status, (status) => status);

  return changes;
};
