import type { EventDto, EventQueryService, RaceDto } from '@event-management/application';
import type {
  StartlistDiffDto,
  StartlistQueryService,
} from '@startlist-management/application';

import type {
  PublicEventRecord,
  PublicEventView,
  PublicRaceRecord,
  PublicRaceView,
  PublicStartlistDetails,
  PublicStartlistRecord,
  PublicStartlistVersionRecord,
} from './models.js';
import type { PublicProjectionRepository } from './repository.js';
import type { PublicProjectionCache, PublicProjectionCacheKey } from './cache/PublicProjectionCache.js';
import type { PublicProjectionCdnClient } from './cdn/HttpPublicProjectionCdnClient.js';

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const DEFAULT_LOGGER: Logger = console;

export interface PublicProjectionRebuiltEventNotification {
  type: 'event';
  event: PublicEventView;
  urls: string[];
  cacheKeys: PublicProjectionCacheKey[];
  occurredAt: string;
  previous?: PublicEventView;
}

export interface PublicProjectionRebuiltStartlistNotification {
  type: 'startlist';
  eventId: string;
  raceId: string;
  startlistId: string;
  startlist: PublicStartlistDetails;
  diff?: StartlistDiffDto;
  urls: string[];
  cacheKeys: PublicProjectionCacheKey[];
  occurredAt: string;
  previous?: PublicStartlistDetails;
}

export type PublicProjectionRebuiltNotification =
  | PublicProjectionRebuiltEventNotification
  | PublicProjectionRebuiltStartlistNotification;

export interface PublicProjectionNotifier {
  notify(event: PublicProjectionRebuiltNotification): Promise<void>;
}

interface BaseOptions {
  repository: PublicProjectionRepository;
  eventQueryService: EventQueryService;
  startlistQueryService: StartlistQueryService;
  cache?: PublicProjectionCache;
  cdnClient?: PublicProjectionCdnClient;
  notifier?: PublicProjectionNotifier;
  logger?: Logger;
  now?: () => Date;
}

export interface RebuildEventOptions extends BaseOptions {
  eventId: string;
  startlistId?: never;
}

export interface RebuildStartlistOptions extends BaseOptions {
  startlistId: string;
  eventId?: never;
}

export type RebuildPublicProjectionOptions = RebuildEventOptions | RebuildStartlistOptions;

export interface RebuildEventResult {
  type: 'event';
  event: PublicEventView;
  urls: string[];
  cacheKeys: PublicProjectionCacheKey[];
  previous?: PublicEventView;
}

export interface RebuildStartlistResult {
  type: 'startlist';
  eventId: string;
  raceId: string;
  startlistId: string;
  startlist: PublicStartlistDetails;
  diff?: StartlistDiffDto;
  urls: string[];
  cacheKeys: PublicProjectionCacheKey[];
  previous?: PublicStartlistDetails;
}

export type RebuildPublicProjectionResult = RebuildEventResult | RebuildStartlistResult;

export class ProjectionRebuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectionRebuildError';
  }
}

const eventUrl = (eventId: string): string => `/api/public/events/${eventId}`;
const startlistUrl = (eventId: string, raceId: string): string =>
  `/api/public/events/${eventId}/races/${raceId}/startlist`;

const mapEventDtoToRecord = (
  dto: EventDto,
  timestamp: string,
  createdAt: string,
): PublicEventRecord => ({
  id: dto.id,
  name: dto.name,
  startDate: dto.startDate,
  endDate: dto.endDate,
  venue: dto.venue,
  allowMultipleRacesPerDay: dto.allowMultipleRacesPerDay,
  allowScheduleOverlap: dto.allowScheduleOverlap,
  createdAt,
  updatedAt: timestamp,
});

const mapRaceDtoToRecord = (
  eventId: string,
  dto: RaceDto,
  timestamp: string,
  createdAt: string,
  startlistId?: string,
): PublicRaceRecord => ({
  id: dto.id,
  eventId,
  name: dto.name,
  schedule: {
    start: dto.schedule.start,
    ...(dto.schedule.end ? { end: dto.schedule.end } : {}),
  },
  duplicateDay: dto.duplicateDay,
  overlapsExisting: dto.overlapsExisting,
  startlistId,
  createdAt,
  updatedAt: timestamp,
});

const toStartlistRecord = (
  snapshot: PublicStartlistRecord['snapshot'],
  confirmedAt: string | undefined,
  timestamp: string,
  createdAt: string,
): PublicStartlistRecord => ({
  id: snapshot.id,
  eventId: snapshot.eventId,
  raceId: snapshot.raceId,
  status: snapshot.status,
  snapshot,
  confirmedAt,
  createdAt,
  updatedAt: timestamp,
});

const mapVersionsToHistory = (
  startlistId: string,
  versions:
    | {
        version: number;
        snapshot: PublicStartlistRecord['snapshot'];
        confirmedAt: string;
      }[]
    | undefined,
): PublicStartlistVersionRecord[] => {
  if (!versions?.length) {
    return [];
  }

  const sorted = [...versions].sort((left, right) => left.version - right.version);
  return sorted.map((version) => ({
    startlistId,
    version: version.version,
    snapshot: structuredClone(version.snapshot),
    confirmedAt: version.confirmedAt,
    createdAt: version.confirmedAt,
  }));
};

const invalidateCaches = async (
  cache: PublicProjectionCache | undefined,
  cdnClient: PublicProjectionCdnClient | undefined,
  cacheKeys: PublicProjectionCacheKey[],
  urls: string[],
  logger: Logger,
): Promise<void> => {
  if (cache && cacheKeys.length) {
    try {
      await cache.invalidate(cacheKeys);
    } catch (error) {
      logger.warn('Failed to invalidate public projection cache', { error });
    }
  }

  if (cdnClient && urls.length) {
    try {
      await cdnClient.purgePaths(urls);
    } catch (error) {
      logger.warn('Failed to purge public projection CDN cache', { error });
    }
  }
};

const resolveRace = (event: EventDto, raceId: string): RaceDto | undefined =>
  event.races.find((race) => race.id === raceId);

const resolveCreatedAt = (record: { createdAt: string } | undefined, fallback: string): string =>
  record?.createdAt ?? fallback;

const buildStartlistConfirmedAt = (
  raceDto: RaceDto | undefined,
  versions: { confirmedAt: string }[] | undefined,
  previous?: PublicStartlistRecord,
): string | undefined => {
  const confirmedAtFromRace = raceDto?.startlist?.confirmedAt;
  if (confirmedAtFromRace) {
    return confirmedAtFromRace;
  }

  const latestVersion = versions?.[versions.length - 1]?.confirmedAt;
  if (latestVersion) {
    return latestVersion;
  }

  return previous?.confirmedAt;
};

const rebuildEvent = async (
  options: RebuildEventOptions,
  timestamp: string,
  logger: Logger,
): Promise<RebuildEventResult> => {
  const { eventQueryService, repository, startlistQueryService } = options;
  const event = await eventQueryService.getById(options.eventId);
  if (!event) {
    throw new ProjectionRebuildError(`Event ${options.eventId} was not found.`);
  }

  const previousEvent = await repository.findEventById(options.eventId);
  const createdAt = resolveCreatedAt(previousEvent, timestamp);

  const eventRecord = mapEventDtoToRecord(event, timestamp, createdAt);
  await repository.upsertEvent(eventRecord);

  const cacheKeySet = new Map<string, PublicProjectionCacheKey>();
  const urls = new Set<string>([eventUrl(event.id)]);
  cacheKeySet.set(`event:${event.id}`, { type: 'event', eventId: event.id });

  for (const race of event.races) {
    const previousRace = previousEvent?.races.find((entry) => entry.id === race.id);
    const raceRecord = mapRaceDtoToRecord(
      event.id,
      race,
      timestamp,
      resolveCreatedAt(previousRace, timestamp),
      race.startlist?.id ?? undefined,
    );
    await repository.upsertRace(raceRecord);

    const startlistId = race.startlist?.id;
    if (!startlistId) {
      continue;
    }

    let snapshot: PublicStartlistRecord['snapshot'];
    try {
      const response = await startlistQueryService.execute({ startlistId });
      snapshot = structuredClone(response);
    } catch (error) {
      logger.warn('Failed to fetch startlist snapshot during targeted rebuild', {
        startlistId,
        error,
      });
      continue;
    }

    const existingDetails = await repository.findStartlistByRace(event.id, race.id);
    const versionsResult = await startlistQueryService
      .listVersions({ startlistId })
      .catch((error) => {
        logger.warn('Failed to fetch startlist versions during targeted rebuild', {
          startlistId,
          error,
        });
        return undefined;
      });

    const versions = versionsResult?.items?.map((item) => ({
      version: item.version,
      snapshot: structuredClone(item.snapshot),
      confirmedAt: item.confirmedAt,
    }));

    const confirmedAt = buildStartlistConfirmedAt(race, versions, existingDetails?.startlist);
    const startlistRecord = toStartlistRecord(
      structuredClone(snapshot),
      confirmedAt,
      timestamp,
      resolveCreatedAt(existingDetails?.startlist, timestamp),
    );

    await repository.upsertStartlist(startlistRecord);

    const historyRecords = mapVersionsToHistory(startlistId, versions);
    await repository.replaceStartlistHistory(startlistId, historyRecords);

    const keyId = `startlist:${event.id}:${race.id}`;
    cacheKeySet.set(keyId, { type: 'startlist', eventId: event.id, raceId: race.id });
    urls.add(startlistUrl(event.id, race.id));
  }

  const cacheKeys = Array.from(cacheKeySet.values());
  const eventView = await repository.findEventById(event.id);
  return {
    type: 'event',
    event: eventView ?? { ...eventRecord, races: [] satisfies PublicRaceView[] },
    urls: Array.from(urls).sort(),
    cacheKeys,
    previous: previousEvent,
  } satisfies RebuildEventResult;
};

const rebuildStartlist = async (
  options: RebuildStartlistOptions,
  timestamp: string,
  logger: Logger,
): Promise<RebuildStartlistResult> => {
  const { startlistQueryService, repository, eventQueryService } = options;
  let snapshot: PublicStartlistRecord['snapshot'];
  try {
    snapshot = await startlistQueryService.execute({ startlistId: options.startlistId });
  } catch (error) {
    logger.warn('Failed to fetch startlist snapshot during targeted rebuild', {
      startlistId: options.startlistId,
      error,
    });
    throw new ProjectionRebuildError(`Startlist ${options.startlistId} was not found.`);
  }

  const previousEvent = await repository.findEventById(snapshot.eventId);
  const previousStartlist = await repository.findStartlistByRace(snapshot.eventId, snapshot.raceId);

  const event = await eventQueryService.getById(snapshot.eventId);
  if (!event) {
    throw new ProjectionRebuildError(
      `Event ${snapshot.eventId} was not found for startlist ${options.startlistId}.`,
    );
  }

  const race = resolveRace(event, snapshot.raceId);
  if (!race) {
    throw new ProjectionRebuildError(
      `Race ${snapshot.raceId} was not found for event ${snapshot.eventId}.`,
    );
  }

  const eventRecord = mapEventDtoToRecord(
    event,
    timestamp,
    resolveCreatedAt(previousEvent, timestamp),
  );
  await repository.upsertEvent(eventRecord);

  const raceRecord = mapRaceDtoToRecord(
    event.id,
    race,
    timestamp,
    resolveCreatedAt(previousEvent?.races.find((entry) => entry.id === race.id), timestamp),
    snapshot.id,
  );
  await repository.upsertRace(raceRecord);

  const versionsResult = await startlistQueryService
    .listVersions({ startlistId: options.startlistId })
    .catch((error) => {
      logger.warn('Failed to fetch startlist versions during targeted rebuild', {
        startlistId: options.startlistId,
        error,
      });
      return undefined;
    });

  const versions = versionsResult?.items?.map((item) => ({
    version: item.version,
    snapshot: structuredClone(item.snapshot),
    confirmedAt: item.confirmedAt,
  }));

  const confirmedAt = buildStartlistConfirmedAt(race, versions, previousStartlist?.startlist);
  const startlistRecord = toStartlistRecord(
    structuredClone(snapshot),
    confirmedAt,
    timestamp,
    resolveCreatedAt(previousStartlist?.startlist, timestamp),
  );

  await repository.upsertStartlist(startlistRecord);

  const historyRecords = mapVersionsToHistory(options.startlistId, versions);
  await repository.replaceStartlistHistory(options.startlistId, historyRecords);

  let diff: StartlistDiffDto | undefined;
  try {
    diff = await startlistQueryService.diff({ startlistId: options.startlistId });
  } catch (error) {
    logger.warn('Failed to diff startlist during targeted rebuild', {
      startlistId: options.startlistId,
      error,
    });
  }

  const cacheKeys: PublicProjectionCacheKey[] = [
    { type: 'event', eventId: snapshot.eventId },
    { type: 'startlist', eventId: snapshot.eventId, raceId: snapshot.raceId },
  ];
  const urls = [eventUrl(snapshot.eventId), startlistUrl(snapshot.eventId, snapshot.raceId)].sort();

  const startlistDetails: PublicStartlistDetails = {
    startlist: startlistRecord,
    history: historyRecords,
  };

  if (options.notifier) {
    await options.notifier.notify({
      type: 'startlist',
      eventId: snapshot.eventId,
      raceId: snapshot.raceId,
      startlistId: options.startlistId,
      startlist: startlistDetails,
      diff,
      urls,
      cacheKeys,
      occurredAt: timestamp,
      previous: previousStartlist,
    });
  }

  return {
    type: 'startlist',
    eventId: snapshot.eventId,
    raceId: snapshot.raceId,
    startlistId: options.startlistId,
    startlist: startlistDetails,
    diff,
    urls,
    cacheKeys,
    previous: previousStartlist,
  } satisfies RebuildStartlistResult;
};

export const rebuildPublicProjectionRecord = async (
  options: RebuildPublicProjectionOptions,
): Promise<RebuildPublicProjectionResult> => {
  const logger = options.logger ?? DEFAULT_LOGGER;
  const timestamp = (options.now?.() ?? new Date()).toISOString();

  if ('eventId' in options && options.eventId) {
    const result = await rebuildEvent(options, timestamp, logger);
    await invalidateCaches(options.cache, options.cdnClient, result.cacheKeys, result.urls, logger);

    if (options.notifier) {
      await options.notifier.notify({
        type: 'event',
        event: result.event,
        urls: result.urls,
        cacheKeys: result.cacheKeys,
        occurredAt: timestamp,
        previous: result.previous,
      });
    }

    return result;
  }

  if ('startlistId' in options && options.startlistId) {
    const result = await rebuildStartlist(options, timestamp, logger);
    await invalidateCaches(options.cache, options.cdnClient, result.cacheKeys, result.urls, logger);
    return result;
  }

  throw new ProjectionRebuildError('Either eventId or startlistId must be provided.');
};

export default rebuildPublicProjectionRecord;
