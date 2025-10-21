import { EventId, RaceId, RaceSchedule } from '@event-management/domain';

export interface StartlistSyncPort {
  notifyRaceScheduled(payload: {
    eventId: EventId;
    raceId: RaceId;
    schedule: RaceSchedule;
    updatedAt: Date;
  }): Promise<void>;
}
