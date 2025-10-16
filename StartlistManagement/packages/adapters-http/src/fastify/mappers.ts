import {
  StartlistSnapshot,
  Duration,
  StartlistSettings,
  LaneAssignment,
  ClassAssignment,
  StartTime,
} from '@startlist-management/domain';
import type { EnterStartlistSettingsCommand } from '@startlist-management/application';
import { InvalidCommandError } from '@startlist-management/application';

export interface DurationResponse {
  milliseconds: number;
}

export interface StartlistSettingsResponse {
  eventId: string;
  startTime: string;
  laneClassInterval: DurationResponse;
  classPlayerInterval: DurationResponse;
  laneCount: number;
}

export type StartlistSettingsRequestBody =
  | ({
        eventId: string;
        startTime: string;
        laneCount: number;
        laneClassInterval: DurationResponse;
        classPlayerInterval: DurationResponse;
        interval?: DurationResponse;
      } & Record<string, unknown>)
  | ({
        eventId: string;
        startTime: string;
        laneCount: number;
        interval: DurationResponse;
      } & Record<string, unknown>);

export interface LaneAssignmentResponse {
  laneNumber: number;
  classOrder: string[];
  interval: DurationResponse;
}

export interface ClassAssignmentResponse {
  classId: string;
  playerOrder: string[];
  interval: DurationResponse;
}

export interface StartTimeResponse {
  playerId: string;
  startTime: string;
  laneNumber: number;
}

export interface StartlistHttpResponse {
  id: string;
  status: StartlistSnapshot['status'];
  settings?: StartlistSettingsResponse;
  laneAssignments: LaneAssignmentResponse[];
  classAssignments: ClassAssignmentResponse[];
  startTimes: StartTimeResponse[];
}

const toDurationResponse = (duration: Duration): DurationResponse => ({
  milliseconds: duration.value,
});

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
    'laneClassInterval' in body
      ? resolveDuration(body.laneClassInterval, body.interval as DurationResponse | undefined)
      : resolveDuration(undefined, body.interval);
  const classPlayerInterval =
    'classPlayerInterval' in body
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
      laneClassInterval,
      classPlayerInterval,
      laneCount: body.laneCount,
    },
  };
};

const mapSettings = (settings: StartlistSettings | undefined): StartlistSettingsResponse | undefined => {
  if (!settings) {
    return undefined;
  }
  return {
    eventId: settings.eventId,
    startTime: settings.startTime.toISOString(),
    laneClassInterval: toDurationResponse(settings.laneClassInterval),
    classPlayerInterval: toDurationResponse(settings.classPlayerInterval),
    laneCount: settings.laneCount,
  };
};

const mapLaneAssignments = (assignments: ReadonlyArray<LaneAssignment>): LaneAssignmentResponse[] => {
  return assignments.map((assignment) => ({
    laneNumber: assignment.laneNumber,
    classOrder: [...assignment.classOrder],
    interval: toDurationResponse(assignment.interval),
  }));
};

const mapClassAssignments = (assignments: ReadonlyArray<ClassAssignment>): ClassAssignmentResponse[] => {
  return assignments.map((assignment) => ({
    classId: assignment.classId,
    playerOrder: [...assignment.playerOrder],
    interval: toDurationResponse(assignment.interval),
  }));
};

const mapStartTimes = (startTimes: ReadonlyArray<StartTime>): StartTimeResponse[] => {
  return startTimes.map((startTime) => ({
    playerId: startTime.playerId,
    startTime: startTime.startTime.toISOString(),
    laneNumber: startTime.laneNumber,
  }));
};

export const toStartlistHttpResponse = (snapshot: StartlistSnapshot): StartlistHttpResponse => ({
  id: snapshot.id,
  status: snapshot.status,
  settings: mapSettings(snapshot.settings),
  laneAssignments: mapLaneAssignments(snapshot.laneAssignments),
  classAssignments: mapClassAssignments(snapshot.classAssignments),
  startTimes: mapStartTimes(snapshot.startTimes),
});
