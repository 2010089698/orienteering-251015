import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createEventModule } from '@event-management/infrastructure';
import type { EventDto, EventQueryService, RaceDto } from '@event-management/application';
import { createStartlistModule } from '@startlist-management/infrastructure';
import type { StartlistQueryService } from '@startlist-management/application';

import {
  type PublicEventRecord,
  type PublicEventView,
  type PublicProjectionRepository,
  type PublicRaceRecord,
  type PublicRaceView,
  type PublicStartlistDetails,
  type PublicStartlistRecord,
} from './models.js';
import { SqlPublicProjectionRepository } from './SqlPublicProjectionRepository.js';
import type { PublicProjectionCache, PublicProjectionCacheKey } from './cache/PublicProjectionCache.js';
import { PublicProjectionCache as RedisPublicProjectionCache } from './cache/PublicProjectionCache.js';
import type { PublicProjectionCdnClient } from './cdn/HttpPublicProjectionCdnClient.js';
import { HttpPublicProjectionCdnClient } from './cdn/HttpPublicProjectionCdnClient.js';

type RedisClientType = import('redis').RedisClientType;

export interface ProjectionRange {
  min?: string;
  max?: string;
}

export interface ProjectionSummary {
  eventCount: number;
  raceCount: number;
  startlistCount: number;
  versionCount: number;
  updatedAt: ProjectionRange;
  urls: string[];
  cacheKeys: PublicProjectionCacheKey[];
}

export interface ProjectionDiff {
  counts: {
    eventCount: number;
    raceCount: number;
    startlistCount: number;
    versionCount: number;
  };
  timestamps: {
    before: ProjectionRange;
    after: ProjectionRange;
  };
  urls: {
    added: string[];
    removed: string[];
  };
}

export interface ToleranceConfig {
  eventCount: number;
  raceCount: number;
  startlistCount: number;
  versionCount: number;
}

export interface ToleranceViolation {
  metric: keyof ToleranceConfig;
  diff: number;
  tolerance: number;
}

export class ToleranceExceededError extends Error {
  readonly violations: ToleranceViolation[];
  readonly diff: ProjectionDiff;

  constructor(message: string, violations: ToleranceViolation[], diff: ProjectionDiff) {
    super(message);
    this.name = 'ToleranceExceededError';
    this.violations = violations;
    this.diff = diff;
  }
}

interface ProjectionState {
  events: Map<string, PublicEventView>;
  races: Map<string, PublicRaceView>;
  startlists: Map<string, PublicStartlistDetails>;
}

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface RebuildPublicProjectionOptions {
  repository?: PublicProjectionRepository;
  databasePath?: string;
  eventQueryService?: EventQueryService;
  startlistQueryService?: StartlistQueryService;
  cache?: PublicProjectionCache;
  cdnClient?: PublicProjectionCdnClient;
  tolerance?: Partial<ToleranceConfig>;
  abortOnToleranceViolation?: boolean;
  logger?: Logger;
  now?: () => Date;
}

export interface RebuildPublicProjectionResult {
  before: ProjectionSummary;
  after: ProjectionSummary;
  diff: ProjectionDiff;
  violations: ToleranceViolation[];
  processed: {
    events: number;
    startlists: number;
    versions: number;
  };
}

const DEFAULT_TOLERANCE: ToleranceConfig = {
  eventCount: Number.POSITIVE_INFINITY,
  raceCount: Number.POSITIVE_INFINITY,
  startlistCount: Number.POSITIVE_INFINITY,
  versionCount: Number.POSITIVE_INFINITY,
};

const DEFAULT_DATABASE_PATH = path.join(process.cwd(), 'public-projection.sqlite3');

const isIsoBefore = (left?: string, right?: string): boolean => {
  if (!left) {
    return true;
  }
  if (!right) {
    return false;
  }
  return left > right;
};

const isIsoAfter = (left?: string, right?: string): boolean => {
  if (!left) {
    return false;
  }
  if (!right) {
    return true;
  }
  return left < right;
};

const resolveTolerance = (config?: Partial<ToleranceConfig>): ToleranceConfig => ({
  eventCount: config?.eventCount ?? DEFAULT_TOLERANCE.eventCount,
  raceCount: config?.raceCount ?? DEFAULT_TOLERANCE.raceCount,
  startlistCount: config?.startlistCount ?? DEFAULT_TOLERANCE.startlistCount,
  versionCount: config?.versionCount ?? DEFAULT_TOLERANCE.versionCount,
});

const captureProjectionState = async (
  repository: PublicProjectionRepository,
): Promise<ProjectionState> => {
  const events = await repository.listEvents();
  const eventMap = new Map<string, PublicEventView>();
  const raceMap = new Map<string, PublicRaceView>();
  const startlistMap = new Map<string, PublicStartlistDetails>();

  for (const event of events) {
    eventMap.set(event.id, structuredClone(event));
    for (const race of event.races) {
      raceMap.set(race.id, structuredClone(race));
      const startlistId = race.startlist?.id ?? race.startlistId;
      if (!startlistId) {
        continue;
      }

      const details = await repository.findStartlistByRace(event.id, race.id);
      if (details) {
        startlistMap.set(startlistId, {
          startlist: structuredClone(details.startlist),
          history: details.history.map((item) => structuredClone(item)),
        });
      }
    }
  }

  return { events: eventMap, races: raceMap, startlists: startlistMap };
};

const summarizeProjection = (state: ProjectionState): ProjectionSummary => {
  let raceCount = 0;
  let startlistCount = 0;
  let versionCount = 0;
  let minTimestamp: string | undefined;
  let maxTimestamp: string | undefined;
  const urls = new Set<string>();
  const cacheKeys: PublicProjectionCacheKey[] = [];

  for (const event of state.events.values()) {
    urls.add(`/api/public/events/${event.id}`);
    cacheKeys.push({ type: 'event', eventId: event.id });
    if (isIsoAfter(event.updatedAt, maxTimestamp)) {
      maxTimestamp = event.updatedAt;
    }
    if (isIsoBefore(minTimestamp, event.updatedAt)) {
      minTimestamp = event.updatedAt;
    }

    raceCount += event.races.length;
    for (const race of event.races) {
      const startlistId = race.startlist?.id ?? race.startlistId;
      if (!startlistId) {
        continue;
      }

      urls.add(`/api/public/events/${event.id}/races/${race.id}/startlist`);
      cacheKeys.push({ type: 'startlist', eventId: event.id, raceId: race.id });
      startlistCount += 1;

      const details = state.startlists.get(startlistId);
      if (details) {
        versionCount += details.history.length;
        if (isIsoAfter(details.startlist.updatedAt, maxTimestamp)) {
          maxTimestamp = details.startlist.updatedAt;
        }
        if (isIsoBefore(minTimestamp, details.startlist.updatedAt)) {
          minTimestamp = details.startlist.updatedAt;
        }
      }
    }
  }

  return {
    eventCount: state.events.size,
    raceCount,
    startlistCount,
    versionCount,
    updatedAt: { min: minTimestamp, max: maxTimestamp },
    urls: [...urls].sort(),
    cacheKeys,
  };
};

const diffProjection = (before: ProjectionSummary, after: ProjectionSummary): ProjectionDiff => {
  const beforeUrls = new Set(before.urls);
  const afterUrls = new Set(after.urls);
  const added = [...afterUrls].filter((url) => !beforeUrls.has(url)).sort();
  const removed = [...beforeUrls].filter((url) => !afterUrls.has(url)).sort();

  return {
    counts: {
      eventCount: after.eventCount - before.eventCount,
      raceCount: after.raceCount - before.raceCount,
      startlistCount: after.startlistCount - before.startlistCount,
      versionCount: after.versionCount - before.versionCount,
    },
    timestamps: { before: before.updatedAt, after: after.updatedAt },
    urls: { added, removed },
  };
};

const evaluateViolations = (
  counts: ProjectionDiff['counts'],
  tolerance: ToleranceConfig,
): ToleranceViolation[] => {
  return (Object.keys(counts) as (keyof ProjectionDiff['counts'])[])
    .map((metric) => ({
      metric: metric as keyof ToleranceConfig,
      diff: Math.abs(counts[metric]),
      tolerance: tolerance[metric as keyof ToleranceConfig],
    }))
    .filter((entry) => entry.diff > entry.tolerance);
};

const refreshCaches = async (
  cache: PublicProjectionCache | undefined,
  cdnClient: PublicProjectionCdnClient | undefined,
  summary: ProjectionSummary,
  logger: Logger,
): Promise<void> => {
  if (cache && summary.cacheKeys.length) {
    try {
      await cache.invalidate(summary.cacheKeys);
    } catch (error) {
      logger.warn('Failed to invalidate public projection cache', { error });
    }
  }

  if (cdnClient && summary.urls.length) {
    try {
      await cdnClient.purgePaths(summary.urls);
    } catch (error) {
      logger.warn('Failed to purge public projection CDN cache', { error });
    }
  }
};

const mapEventDtoToRecord = (dto: EventDto, timestamp: string, createdAt: string): PublicEventRecord => ({
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

export const rebuildPublicProjection = async (
  options: RebuildPublicProjectionOptions = {},
): Promise<RebuildPublicProjectionResult> => {
  const logger = options.logger ?? console;
  const timestamp = (options.now?.() ?? new Date()).toISOString();

  const eventQueryService = options.eventQueryService ?? createEventModule().eventQueryService;
  const startlistQueryService = options.startlistQueryService ?? createStartlistModule().queryService;

  const repository =
    options.repository ??
    (await SqlPublicProjectionRepository.initialize({
      databasePath: options.databasePath ?? DEFAULT_DATABASE_PATH,
    }));

  const beforeState = await captureProjectionState(repository);
  const beforeSummary = summarizeProjection(beforeState);

  logger.info('Starting public projection rebuild', { before: beforeSummary });

  await repository.clearAll();

  const events = await eventQueryService.listAll();
  let startlistsProcessed = 0;
  let versionsProcessed = 0;

  for (const event of events) {
    const previousEvent = beforeState.events.get(event.id);
    const eventRecord = mapEventDtoToRecord(event, timestamp, previousEvent?.createdAt ?? timestamp);
    await repository.upsertEvent(eventRecord);

    for (const race of event.races) {
      const previousRace = beforeState.races.get(race.id);
      const startlistId = race.startlist?.id ?? undefined;
      const raceRecord = mapRaceDtoToRecord(
        event.id,
        race,
        timestamp,
        previousRace?.createdAt ?? timestamp,
        startlistId,
      );
      await repository.upsertRace(raceRecord);

      if (!startlistId) {
        continue;
      }

      let snapshot: PublicStartlistRecord['snapshot'];
      try {
        snapshot = await startlistQueryService.execute({ startlistId });
      } catch (error) {
        logger.warn('Failed to fetch startlist snapshot during rebuild', { startlistId, error });
        continue;
      }

      const previousStartlist = beforeState.startlists.get(startlistId);
      const versionResult = await startlistQueryService
        .listVersions({ startlistId })
        .catch((error) => {
          logger.warn('Failed to fetch startlist versions during rebuild', { startlistId, error });
          return undefined;
        });

      const sortedVersions = versionResult
        ? [...versionResult.items].sort((left, right) => left.version - right.version)
        : undefined;

      const confirmedAt =
        race.startlist?.confirmedAt ??
        sortedVersions?.[sortedVersions.length - 1]?.confirmedAt ??
        previousStartlist?.startlist.confirmedAt;

      const startlistRecord = toStartlistRecord(
        structuredClone(snapshot),
        confirmedAt,
        timestamp,
        previousStartlist?.startlist.createdAt ?? timestamp,
      );

      await repository.upsertStartlist(startlistRecord);
      startlistsProcessed += 1;

      if (sortedVersions) {
        for (const version of sortedVersions) {
          await repository.appendStartlistVersion({
            startlistId,
            snapshot: structuredClone(version.snapshot),
            confirmedAt: version.confirmedAt,
            createdAt: version.confirmedAt,
          });
          versionsProcessed += 1;
        }
      }
    }
  }

  const afterState = await captureProjectionState(repository);
  const afterSummary = summarizeProjection(afterState);
  const diff = diffProjection(beforeSummary, afterSummary);

  logger.info('Completed public projection rebuild', {
    processed: {
      events: events.length,
      startlists: startlistsProcessed,
      versions: versionsProcessed,
    },
    diff,
    after: afterSummary,
  });

  await refreshCaches(options.cache, options.cdnClient, afterSummary, logger);

  const tolerance = resolveTolerance(options.tolerance);
  const violations = evaluateViolations(diff.counts, tolerance);

  if (violations.length && (options.abortOnToleranceViolation ?? true)) {
    const message = 'Public projection rebuild exceeded configured tolerances';
    logger.error(message, { violations, diff });
    throw new ToleranceExceededError(message, violations, diff);
  }

  if (violations.length) {
    logger.warn('Public projection rebuild tolerances exceeded, continuing', { violations, diff });
  }

  return {
    before: beforeSummary,
    after: afterSummary,
    diff,
    violations,
    processed: {
      events: events.length,
      startlists: startlistsProcessed,
      versions: versionsProcessed,
    },
  };
};

interface EnvConfig {
  databasePath: string;
  redisUrl?: string;
  cdnEndpoint?: string;
  cdnToken?: string;
  tolerance: ToleranceConfig;
  abortOnToleranceViolation: boolean;
}

const parseInteger = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) {
    return defaultValue;
  }
  return value === 'true' || value === '1';
};

const resolveConfigFromEnv = (): EnvConfig => {
  const databasePath = process.env.PUBLIC_PROJECTION_DB ?? DEFAULT_DATABASE_PATH;
  const redisUrl = process.env.PUBLIC_PROJECTION_REDIS_URL;
  const cdnEndpoint = process.env.PUBLIC_PROJECTION_CDN_PURGE_URL;
  const cdnToken = process.env.PUBLIC_PROJECTION_CDN_PURGE_TOKEN;

  const tolerance: ToleranceConfig = {
    eventCount: parseInteger(process.env.PUBLIC_PROJECTION_TOLERANCE_EVENTS) ?? DEFAULT_TOLERANCE.eventCount,
    raceCount: parseInteger(process.env.PUBLIC_PROJECTION_TOLERANCE_RACES) ?? DEFAULT_TOLERANCE.raceCount,
    startlistCount:
      parseInteger(process.env.PUBLIC_PROJECTION_TOLERANCE_STARTLISTS) ?? DEFAULT_TOLERANCE.startlistCount,
    versionCount:
      parseInteger(process.env.PUBLIC_PROJECTION_TOLERANCE_VERSIONS) ?? DEFAULT_TOLERANCE.versionCount,
  };

  const abortOnToleranceViolation = parseBoolean(
    process.env.PUBLIC_PROJECTION_TOLERANCE_ABORT,
    true,
  );

  return { databasePath, redisUrl, cdnEndpoint, cdnToken, tolerance, abortOnToleranceViolation };
};

const connectRedis = async (redisUrl: string | undefined): Promise<{
  client?: RedisClientType;
  cache?: PublicProjectionCache;
}> => {
  if (!redisUrl) {
    return {};
  }

  let redisModule: typeof import('redis');
  try {
    redisModule = await import('redis');
  } catch (error) {
    console.warn('Redis client is not available, skipping cache refresh', error);
    return {};
  }

  const client = redisModule.createClient({ url: redisUrl });
  client.on('error', (error) => {
    console.error('Public projection Redis error', error);
  });

  try {
    await client.connect();
    return { client, cache: new RedisPublicProjectionCache(client) };
  } catch (error) {
    console.warn('Failed to connect to Redis for public projection rebuild', error);
    return { client: undefined, cache: undefined };
  }
};

const buildCdnClient = (endpoint?: string, token?: string): PublicProjectionCdnClient | undefined => {
  if (!endpoint) {
    return undefined;
  }

  return new HttpPublicProjectionCdnClient({ endpoint, authorizationToken: token });
};

const runFromCli = async (): Promise<void> => {
  const config = resolveConfigFromEnv();

  let redisClient: RedisClientType | undefined;
  try {
    const repository = await SqlPublicProjectionRepository.initialize({
      databasePath: config.databasePath,
    });

    const { client, cache } = await connectRedis(config.redisUrl);
    redisClient = client;
    const cdnClient = buildCdnClient(config.cdnEndpoint, config.cdnToken);

    await rebuildPublicProjection({
      repository,
      cache,
      cdnClient,
      tolerance: config.tolerance,
      abortOnToleranceViolation: config.abortOnToleranceViolation,
    });
  } catch (error) {
    console.error('Public projection rebuild failed', error);
    await redisClient?.quit().catch(() => undefined);
    process.exit(1);
  }

  try {
    await redisClient?.quit();
  } catch (error) {
    console.warn('Failed to close Redis connection after rebuild', error);
  }
};

const isExecutedAsCli = (): boolean => {
  const executed = process.argv[1];
  if (!executed) {
    return false;
  }
  return path.resolve(executed) === fileURLToPath(import.meta.url);
};

if (isExecutedAsCli()) {
  void runFromCli();
}

export default rebuildPublicProjection;
