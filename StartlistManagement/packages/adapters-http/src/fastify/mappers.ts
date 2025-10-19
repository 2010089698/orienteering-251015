import type {
  StartlistSnapshot,
  DurationDto,
  StartlistSettingsDto,
  LaneAssignmentDto,
  ClassAssignmentDto,
  StartTimeDto,
} from '@startlist-management/domain';
import { cloneStartlistSnapshotDto } from '@startlist-management/domain';
import type { EnterStartlistSettingsCommand } from '@startlist-management/application';
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

export type StartlistHttpResponse = StartlistSnapshot;

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

export const toStartlistHttpResponse = (snapshot: StartlistSnapshot): StartlistHttpResponse => {
  return cloneStartlistSnapshotDto(snapshot);
};
