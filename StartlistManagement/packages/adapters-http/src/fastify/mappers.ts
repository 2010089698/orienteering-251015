import type {
  StartlistSnapshot,
  DurationDto,
  StartlistSettingsDto,
  LaneAssignmentDto,
  ClassAssignmentDto,
  StartTimeDto,
} from '@startlist-management/domain';
import { cloneStartlistSnapshotDto } from '@startlist-management/domain';
import type {
  EnterStartlistSettingsCommand,
  StartlistDiffDto,
  StartlistDiffValue,
  StartlistVersionSummaryDto,
  StartlistWithHistoryDto,
} from '@startlist-management/application';
import { InvalidCommandError } from '@startlist-management/application';

export type DurationResponse = DurationDto;

export type StartlistSettingsResponse = StartlistSettingsDto;

export type StartlistSettingsRequestBody =
  | ({
        eventId: string;
        startTime: string;
        laneCount: number;
        intervals: {
          laneClass: DurationResponse;
          classPlayer: DurationResponse;
        };
        laneClassInterval?: DurationResponse;
        classPlayerInterval?: DurationResponse;
        interval?: DurationResponse;
      } & Record<string, unknown>)
  | ({
        eventId: string;
        startTime: string;
        laneCount: number;
        interval: DurationResponse;
      } & Record<string, unknown>);

export type LaneAssignmentResponse = LaneAssignmentDto;

export type ClassAssignmentResponse = ClassAssignmentDto;

export type StartTimeResponse = StartTimeDto;

export type StartlistVersionSummaryResponse = StartlistVersionSummaryDto;

export type StartlistDiffResponse = StartlistDiffDto;

export type StartlistHttpResponse = StartlistWithHistoryDto;

const copyDuration = (duration: DurationResponse): DurationResponse => ({
  milliseconds: duration.milliseconds,
});

const resolveDuration = (
  primary: DurationResponse | undefined,
  fallback: DurationResponse | undefined,
): DurationResponse | undefined => {
  if (primary) {
    return copyDuration(primary);
  }
  if (fallback) {
    return copyDuration(fallback);
  }
  return undefined;
};

export const toEnterStartlistSettingsCommand = (
  startlistId: string,
  body: StartlistSettingsRequestBody,
): EnterStartlistSettingsCommand => {
  const laneClassInterval =
    'intervals' in body
      ? resolveDuration(body.intervals.laneClass, body.interval as DurationResponse | undefined)
      : 'laneClassInterval' in body
        ? resolveDuration(body.laneClassInterval, body.interval as DurationResponse | undefined)
        : resolveDuration(undefined, body.interval);
  const classPlayerInterval =
    'intervals' in body
      ? resolveDuration(body.intervals.classPlayer, body.interval as DurationResponse | undefined)
      : 'classPlayerInterval' in body
        ? resolveDuration(body.classPlayerInterval, body.interval as DurationResponse | undefined)
        : resolveDuration(undefined, body.interval);

  if (!laneClassInterval || !classPlayerInterval) {
    throw new InvalidCommandError('Both laneClassInterval and classPlayerInterval must be provided.');
  }

  return {
    startlistId,
    settings: {
      eventId: body.eventId,
      startTime: body.startTime,
      intervals: {
        laneClass: laneClassInterval,
        classPlayer: classPlayerInterval,
      },
      laneCount: body.laneCount,
    },
  };
};

const cloneVersionSummary = (summary: StartlistVersionSummaryDto): StartlistVersionSummaryDto => ({
  version: summary.version,
  confirmedAt: summary.confirmedAt,
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

const cloneSettings = (settings: StartlistSettingsDto): StartlistSettingsDto => ({
  eventId: settings.eventId,
  startTime: settings.startTime,
  laneCount: settings.laneCount,
  intervals: {
    laneClass: { milliseconds: settings.intervals.laneClass.milliseconds },
    classPlayer: { milliseconds: settings.intervals.classPlayer.milliseconds },
  },
});

const cloneDiffValue = <T>(value: StartlistDiffValue<T>, clone: (inner: T) => T): StartlistDiffValue<T> => ({
  ...(value.previous !== undefined ? { previous: clone(value.previous) } : {}),
  ...(value.current !== undefined ? { current: clone(value.current) } : {}),
});

const cloneDiff = (diff: StartlistDiffDto): StartlistDiffDto => ({
  startlistId: diff.startlistId,
  to: cloneVersionSummary(diff.to),
  ...(diff.from ? { from: cloneVersionSummary(diff.from) } : {}),
  changes: {
    ...(diff.changes.settings
      ? { settings: cloneDiffValue(diff.changes.settings, cloneSettings) }
      : {}),
    ...(diff.changes.laneAssignments
      ? { laneAssignments: cloneDiffValue(diff.changes.laneAssignments, cloneLaneAssignments) }
      : {}),
    ...(diff.changes.classAssignments
      ? { classAssignments: cloneDiffValue(diff.changes.classAssignments, cloneClassAssignments) }
      : {}),
    ...(diff.changes.startTimes
      ? { startTimes: cloneDiffValue(diff.changes.startTimes, cloneStartTimes) }
      : {}),
    ...(diff.changes.status
      ? { status: cloneDiffValue(diff.changes.status, (status) => status) }
      : {}),
  },
});

export const toStartlistHttpResponse = (result: StartlistWithHistoryDto): StartlistHttpResponse => {
  const { versions, diff, ...snapshot } = result;
  const baseSnapshot = cloneStartlistSnapshotDto(snapshot);
  return {
    ...baseSnapshot,
    ...(versions ? { versions: versions.map(cloneVersionSummary) } : {}),
    ...(diff ? { diff: cloneDiff(diff) } : {}),
  };
};
