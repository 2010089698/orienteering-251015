import type { StartlistSnapshot } from '@startlist-management/domain';

export interface PublicEventRecord {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  venue: string;
  allowMultipleRacesPerDay: boolean;
  allowScheduleOverlap: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicRaceRecord {
  id: string;
  eventId: string;
  name: string;
  schedule: {
    start: string;
    end?: string;
  };
  duplicateDay: boolean;
  overlapsExisting: boolean;
  startlistId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicStartlistRecord {
  id: string;
  eventId: string;
  raceId: string;
  status: string;
  snapshot: StartlistSnapshot;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewPublicStartlistVersion {
  startlistId: string;
  snapshot: StartlistSnapshot;
  confirmedAt: string;
  createdAt: string;
}

export interface PublicStartlistVersionRecord extends NewPublicStartlistVersion {
  version: number;
}

export interface PublicRaceView extends PublicRaceRecord {
  startlist?: PublicStartlistRecord;
}

export interface PublicEventView extends PublicEventRecord {
  races: PublicRaceView[];
}

export interface PublicStartlistDetails {
  startlist: PublicStartlistRecord;
  history: PublicStartlistVersionRecord[];
}
