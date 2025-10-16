import {
  StartlistSnapshot,
  Duration,
  StartlistSettings,
  LaneAssignment,
  ClassAssignment,
  StartTime,
} from '@startlist-management/domain';

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
