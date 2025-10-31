import type { EventQueryService, EventDto, RaceDto } from '@event-management/application';
import { EventCreated, RaceScheduled } from '@event-management/domain';
import {
  StartlistFinalizedEvent,
  StartlistSettingsEnteredEvent,
  StartlistVersionGeneratedEvent,
} from '@startlist-management/domain';
import type { StartlistQueryService } from '@startlist-management/application';

import type {
  NewPublicStartlistVersion,
  PublicEventRecord,
  PublicRaceRecord,
  PublicStartlistRecord,
} from './models.js';
import type { PublicProjectionRepository } from './repository.js';
import type {
  PublicProjectionCache,
  PublicProjectionCacheKey,
} from './cache/PublicProjectionCache.js';
import type { PublicProjectionCdnClient } from './cdn/HttpPublicProjectionCdnClient.js';

export interface PublicProjectionSubscriberOptions {
  repository: PublicProjectionRepository;
  eventQueryService: EventQueryService;
  startlistQueryService: StartlistQueryService;
  cache?: PublicProjectionCache;
  cdnClient?: PublicProjectionCdnClient;
}

export class PublicProjectionSubscriber {
  private readonly repository: PublicProjectionRepository;
  private readonly eventQueryService: EventQueryService;
  private readonly startlistQueryService: StartlistQueryService;
  private readonly cache?: PublicProjectionCache;
  private readonly cdnClient?: PublicProjectionCdnClient;

  constructor(options: PublicProjectionSubscriberOptions) {
    this.repository = options.repository;
    this.eventQueryService = options.eventQueryService;
    this.startlistQueryService = options.startlistQueryService;
    this.cache = options.cache;
    this.cdnClient = options.cdnClient;
  }

  async handle(event: unknown): Promise<void> {
    if (event instanceof EventCreated) {
      await this.handleEventCreated(event);
      return;
    }

    if (event instanceof RaceScheduled) {
      await this.handleRaceScheduled(event);
      return;
    }

    if (event instanceof StartlistSettingsEnteredEvent) {
      await this.handleStartlistSettingsEntered(event);
      return;
    }

    if (event instanceof StartlistFinalizedEvent) {
      await this.handleStartlistFinalized(event);
      return;
    }

    if (event instanceof StartlistVersionGeneratedEvent) {
      await this.handleStartlistVersionGenerated(event);
    }
  }

  private async handleEventCreated(event: EventCreated): Promise<void> {
    const eventId = event.eventId.toString();
    const dto = await this.eventQueryService.getById(eventId);
    if (!dto) {
      return;
    }

    const record = this.mapEventDtoToRecord(dto, event.occurredAt.toISOString());
    await this.repository.upsertEvent(record);
    await this.invalidateCache([{ type: 'event', eventId }]);
  }

  private async handleRaceScheduled(event: RaceScheduled): Promise<void> {
    const eventId = event.eventId.toString();
    const dto = await this.eventQueryService.getById(eventId);
    if (!dto) {
      return;
    }

    const raceDto = dto.races.find((race) => race.id === event.raceId.toString());
    if (!raceDto) {
      return;
    }

    const timestamp = event.occurredAt.toISOString();
    await this.repository.upsertEvent(this.mapEventDtoToRecord(dto, timestamp));
    await this.repository.upsertRace(this.mapRaceDtoToRecord(dto.id, raceDto, timestamp));
    await this.invalidateCache([{ type: 'event', eventId }]);
  }

  private async handleStartlistSettingsEntered(event: StartlistSettingsEnteredEvent): Promise<void> {
    const snapshot = await this.startlistQueryService.execute({ startlistId: event.startlistId });
    const timestamp = event.occurredAt.toISOString();
    await this.syncStartlist(snapshot, timestamp);
  }

  private async handleStartlistFinalized(event: StartlistFinalizedEvent): Promise<void> {
    const timestamp = event.occurredAt.toISOString();
    await this.syncStartlist(event.finalStartlist, timestamp, timestamp);
  }

  private async handleStartlistVersionGenerated(event: StartlistVersionGeneratedEvent): Promise<void> {
    const timestamp = event.confirmedAt.toISOString();
    await this.syncStartlist(event.snapshot, timestamp, timestamp);
    await this.appendVersionHistory({
      startlistId: event.startlistId,
      snapshot: event.snapshot,
      confirmedAt: timestamp,
      createdAt: timestamp,
    });
    await this.invalidateCache([
      { type: 'startlist', eventId: event.snapshot.eventId, raceId: event.snapshot.raceId },
    ]);
  }

  private async syncStartlist(
    snapshot: PublicStartlistRecord['snapshot'],
    timestamp: string,
    confirmedAt?: string,
  ): Promise<void> {
    const startlistRecord: PublicStartlistRecord = {
      id: snapshot.id,
      eventId: snapshot.eventId,
      raceId: snapshot.raceId,
      status: snapshot.status,
      snapshot,
      confirmedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const existing = await this.repository.findStartlistByRace(snapshot.eventId, snapshot.raceId);
    const createdAt = existing?.startlist.createdAt ?? timestamp;
    await this.repository.upsertStartlist({ ...startlistRecord, createdAt });

    await this.syncRaceForStartlist(snapshot.eventId, snapshot.raceId, snapshot.id, timestamp);
    await this.invalidateCache([
      { type: 'event', eventId: snapshot.eventId },
      { type: 'startlist', eventId: snapshot.eventId, raceId: snapshot.raceId },
    ]);
  }

  private async syncRaceForStartlist(
    eventId: string,
    raceId: string,
    startlistId: string,
    timestamp: string,
  ): Promise<void> {
    const dto = await this.eventQueryService.getById(eventId);
    if (!dto) {
      return;
    }

    const raceDto = dto.races.find((race) => race.id === raceId);
    if (!raceDto) {
      return;
    }

    const existingEvent = await this.repository.findEventById(eventId);
    const eventCreatedAt = existingEvent?.createdAt ?? timestamp;
    await this.repository.upsertEvent({
      ...this.mapEventDtoToRecord(dto, timestamp),
      createdAt: eventCreatedAt,
    });

    const existingRace = existingEvent?.races.find((race) => race.id === raceId);
    const raceCreatedAt = existingRace?.createdAt ?? timestamp;
    await this.repository.upsertRace({
      ...this.mapRaceDtoToRecord(eventId, raceDto, timestamp),
      startlistId,
      createdAt: raceCreatedAt,
    });
  }

  private async appendVersionHistory(record: NewPublicStartlistVersion): Promise<void> {
    await this.repository.appendStartlistVersion(record);
  }

  private mapEventDtoToRecord(dto: EventDto, timestamp: string): PublicEventRecord {
    return {
      id: dto.id,
      name: dto.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
      venue: dto.venue,
      allowMultipleRacesPerDay: dto.allowMultipleRacesPerDay,
      allowScheduleOverlap: dto.allowScheduleOverlap,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private mapRaceDtoToRecord(eventId: string, dto: RaceDto, timestamp: string): PublicRaceRecord {
    return {
      id: dto.id,
      eventId,
      name: dto.name,
      schedule: {
        start: dto.schedule.start,
        ...(dto.schedule.end ? { end: dto.schedule.end } : {}),
      },
      duplicateDay: dto.duplicateDay,
      overlapsExisting: dto.overlapsExisting,
      startlistId: dto.startlist?.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private async invalidateCache(keys: PublicProjectionCacheKey[]): Promise<void> {
    if (!keys.length) {
      return;
    }

    if (this.cache) {
      await this.cache.invalidate(keys);
    }

    if (!this.cdnClient) {
      return;
    }

    const paths = new Set<string>();
    for (const key of keys) {
      if (key.type === 'event') {
        paths.add(`/api/public/events/${key.eventId}`);
      } else {
        paths.add(`/api/public/events/${key.eventId}/races/${key.raceId}/startlist`);
      }
    }

    if (!paths.size) {
      return;
    }

    void this.cdnClient
      .purgePaths([...paths])
      .catch(() => {
        /* ignore CDN purge errors */
      });
  }
}
