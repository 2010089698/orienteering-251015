import type {
  NewPublicStartlistVersion,
  PublicEventRecord,
  PublicEventView,
  PublicRaceRecord,
  PublicStartlistDetails,
  PublicStartlistRecord,
  PublicStartlistVersionRecord,
} from './models.js';

export interface PublicProjectionRepository {
  upsertEvent(record: PublicEventRecord): Promise<void>;
  upsertRace(record: PublicRaceRecord): Promise<void>;
  upsertStartlist(record: PublicStartlistRecord): Promise<void>;
  appendStartlistVersion(record: NewPublicStartlistVersion): Promise<PublicStartlistVersionRecord>;
  replaceStartlistHistory(
    startlistId: string,
    history: PublicStartlistVersionRecord[],
  ): Promise<void>;
  clearAll(): Promise<void>;
  listEvents(): Promise<PublicEventView[]>;
  findEventById(eventId: string): Promise<PublicEventView | undefined>;
  findStartlistByRace(eventId: string, raceId: string): Promise<PublicStartlistDetails | undefined>;
}
