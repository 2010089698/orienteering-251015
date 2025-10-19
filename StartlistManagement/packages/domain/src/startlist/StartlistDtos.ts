import { ClassAssignment } from './ClassAssignment.js';
import { Duration } from './Duration.js';
import { LaneAssignment } from './LaneAssignment.js';
import { StartTime } from './StartTime.js';
import { StartlistSettings } from './StartlistSettings.js';
import { StartlistStatus } from './StartlistStatus.js';

export interface DurationDto {
  milliseconds: number;
}

export interface StartlistIntervalsDto {
  laneClass: DurationDto;
  classPlayer: DurationDto;
}

export interface StartlistSettingsDto {
  eventId: string;
  startTime: string;
  intervals: StartlistIntervalsDto;
  laneCount: number;
}

export interface LaneAssignmentDto {
  laneNumber: number;
  classOrder: string[];
  interval: DurationDto;
}

export interface ClassAssignmentDto {
  classId: string;
  playerOrder: string[];
  interval: DurationDto;
}

export interface StartTimeDto {
  playerId: string;
  startTime: string;
  laneNumber: number;
}

export interface StartlistSnapshotDto {
  id: string;
  settings?: StartlistSettingsDto;
  laneAssignments: LaneAssignmentDto[];
  classAssignments: ClassAssignmentDto[];
  startTimes: StartTimeDto[];
  status: StartlistStatus;
}

const cloneDurationDto = (dto: DurationDto): DurationDto => ({ milliseconds: dto.milliseconds });

const cloneStringArray = (items: string[]): string[] => [...items];

const toDurationDto = (duration: Duration): DurationDto => ({ milliseconds: duration.value });

const fromDurationDto = (dto: DurationDto): Duration => Duration.fromMilliseconds(dto.milliseconds);

const toIsoString = (value: Date): string => value.toISOString();

const fromIsoString = (value: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date value: ${value}`);
  }
  return parsed;
};

export const toStartlistSettingsDto = (settings: StartlistSettings): StartlistSettingsDto => ({
  eventId: settings.eventId,
  startTime: toIsoString(settings.startTime),
  intervals: {
    laneClass: toDurationDto(settings.laneClassInterval),
    classPlayer: toDurationDto(settings.classPlayerInterval),
  },
  laneCount: settings.laneCount,
});

export const fromStartlistSettingsDto = (
  dto: StartlistSettingsDto,
): StartlistSettings =>
  StartlistSettings.create({
    eventId: dto.eventId,
    startTime: fromIsoString(dto.startTime),
    laneClassInterval: fromDurationDto(dto.intervals.laneClass),
    classPlayerInterval: fromDurationDto(dto.intervals.classPlayer),
    laneCount: dto.laneCount,
  });

export const toLaneAssignmentDto = (assignment: LaneAssignment): LaneAssignmentDto => ({
  laneNumber: assignment.laneNumber,
  classOrder: cloneStringArray(Array.from(assignment.classOrder)),
  interval: toDurationDto(assignment.interval),
});

export const fromLaneAssignmentDtos = (
  dtos: LaneAssignmentDto[],
  laneCount?: number,
): LaneAssignment[] => {
  const resolvedLaneCount =
    laneCount ?? dtos.reduce((max, dto) => Math.max(max, dto.laneNumber), 0);
  return dtos.map((dto) =>
    LaneAssignment.create({
      laneNumber: dto.laneNumber,
      classOrder: cloneStringArray(dto.classOrder),
      interval: fromDurationDto(dto.interval),
      laneCount: resolvedLaneCount,
    }),
  );
};

export const toClassAssignmentDto = (assignment: ClassAssignment): ClassAssignmentDto => ({
  classId: assignment.classId,
  playerOrder: cloneStringArray(Array.from(assignment.playerOrder)),
  interval: toDurationDto(assignment.interval),
});

export const fromClassAssignmentDtos = (dtos: ClassAssignmentDto[]): ClassAssignment[] =>
  dtos.map((dto) =>
    ClassAssignment.create({
      classId: dto.classId,
      playerOrder: cloneStringArray(dto.playerOrder),
      interval: fromDurationDto(dto.interval),
    }),
  );

export const toStartTimeDto = (startTime: StartTime): StartTimeDto => ({
  playerId: startTime.playerId,
  startTime: toIsoString(startTime.startTime),
  laneNumber: startTime.laneNumber,
});

export const fromStartTimeDtos = (dtos: StartTimeDto[]): StartTime[] =>
  dtos.map((dto) =>
    StartTime.create({
      playerId: dto.playerId,
      startTime: fromIsoString(dto.startTime),
      laneNumber: dto.laneNumber,
    }),
  );

export const toStartlistSnapshotDto = (params: {
  id: string;
  settings?: StartlistSettings;
  laneAssignments: ReadonlyArray<LaneAssignment>;
  classAssignments: ReadonlyArray<ClassAssignment>;
  startTimes: ReadonlyArray<StartTime>;
  status: StartlistStatus;
}): StartlistSnapshotDto => ({
  id: params.id,
  settings: params.settings ? toStartlistSettingsDto(params.settings) : undefined,
  laneAssignments: params.laneAssignments.map(toLaneAssignmentDto),
  classAssignments: params.classAssignments.map(toClassAssignmentDto),
  startTimes: params.startTimes.map(toStartTimeDto),
  status: params.status,
});

export const fromStartlistSnapshotDto = (
  snapshot: StartlistSnapshotDto,
): {
  settings?: StartlistSettings;
  laneAssignments: LaneAssignment[];
  classAssignments: ClassAssignment[];
  startTimes: StartTime[];
  status: StartlistStatus;
} => {
  const settings = snapshot.settings ? fromStartlistSettingsDto(snapshot.settings) : undefined;
  const laneAssignments = fromLaneAssignmentDtos(snapshot.laneAssignments, settings?.laneCount);
  const classAssignments = fromClassAssignmentDtos(snapshot.classAssignments);
  const startTimes = fromStartTimeDtos(snapshot.startTimes);
  return {
    settings,
    laneAssignments,
    classAssignments,
    startTimes,
    status: snapshot.status,
  };
};

export const cloneStartlistSnapshotDto = (snapshot: StartlistSnapshotDto): StartlistSnapshotDto => ({
  id: snapshot.id,
  status: snapshot.status,
  settings: snapshot.settings
    ? {
        eventId: snapshot.settings.eventId,
        startTime: snapshot.settings.startTime,
        laneCount: snapshot.settings.laneCount,
        intervals: {
          laneClass: cloneDurationDto(snapshot.settings.intervals.laneClass),
          classPlayer: cloneDurationDto(snapshot.settings.intervals.classPlayer),
        },
      }
    : undefined,
  laneAssignments: snapshot.laneAssignments.map((assignment) => ({
    laneNumber: assignment.laneNumber,
    classOrder: cloneStringArray(assignment.classOrder),
    interval: cloneDurationDto(assignment.interval),
  })),
  classAssignments: snapshot.classAssignments.map((assignment) => ({
    classId: assignment.classId,
    playerOrder: cloneStringArray(assignment.playerOrder),
    interval: cloneDurationDto(assignment.interval),
  })),
  startTimes: snapshot.startTimes.map((startTime) => ({
    playerId: startTime.playerId,
    startTime: startTime.startTime,
    laneNumber: startTime.laneNumber,
  })),
});
