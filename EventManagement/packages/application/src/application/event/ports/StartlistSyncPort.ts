import { EventId, RaceId, RaceSchedule } from '@event-management/domain';

export interface StartlistSyncPayload {
  eventId: EventId;
  raceId: RaceId;
  schedule: RaceSchedule;
  updatedAt: Date;
}

export interface StartlistCreationResult {
  startlistId: string;
  status: string;
}

export interface StartlistSyncPort {
  notifyRaceScheduled(payload: StartlistSyncPayload): Promise<void>;

  createStartlist(payload: StartlistSyncPayload): Promise<StartlistCreationResult>;
}
