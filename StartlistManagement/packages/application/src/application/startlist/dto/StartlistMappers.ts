import {
  Duration,
  ClassAssignment,
  LaneAssignment,
  StartTime,
  StartlistSettings,
} from '@startlist-management/domain';
import {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
} from './StartlistDtos.js';

const toDate = (value: Date | string): Date => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date;
};

const toDuration = (dto: { milliseconds: number }): Duration => {
  return Duration.fromMilliseconds(dto.milliseconds);
};

export const toStartlistSettings = (dto: StartlistSettingsDto): StartlistSettings => {
  return StartlistSettings.create({
    eventId: dto.eventId,
    startTime: toDate(dto.startTime),
    interval: toDuration(dto.interval),
    laneCount: dto.laneCount,
  });
};

export const toLaneAssignments = (dtos: LaneAssignmentDto[], laneCount: number): LaneAssignment[] => {
  return dtos.map((dto) =>
    LaneAssignment.create({
      laneNumber: dto.laneNumber,
      classOrder: dto.classOrder,
      interval: toDuration(dto.interval),
      laneCount,
    }),
  );
};

export const toClassAssignments = (dtos: ClassAssignmentDto[]): ClassAssignment[] => {
  return dtos.map((dto) =>
    ClassAssignment.create({
      classId: dto.classId,
      playerOrder: dto.playerOrder,
      interval: toDuration(dto.interval),
    }),
  );
};

export const toStartTimes = (dtos: StartTimeDto[]): StartTime[] => {
  return dtos.map((dto) =>
    StartTime.create({
      playerId: dto.playerId,
      startTime: toDate(dto.startTime),
      laneNumber: dto.laneNumber,
    }),
  );
};
