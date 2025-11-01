import Fastify from 'fastify';
import cors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import path from 'node:path';

import { entryRoutes } from '@entry-management/adapters-http';
import { createEntryModule } from '@entry-management/infrastructure/config/entryModule';
import { eventRoutes } from '@event-management/adapters-http';
import { createEventModule } from '@event-management/infrastructure';
import { startlistRoutes } from '@startlist-management/adapters-http';
import { createStartlistModule } from '@startlist-management/infrastructure';

import { createClient, type RedisClientType } from 'redis';

import { publicProjectionRoutes } from './publicProjection/routes.js';
import { SqlPublicProjectionRepository } from './publicProjection/SqlPublicProjectionRepository.js';
import { PublicProjectionSubscriber } from './publicProjection/PublicProjectionSubscriber.js';
import { PublicProjectionCache } from './publicProjection/cache/PublicProjectionCache.js';
import {
  HttpPublicProjectionCdnClient,
  type PublicProjectionCdnClient,
} from './publicProjection/cdn/HttpPublicProjectionCdnClient.js';

const start = async () => {
  const entryModule = createEntryModule();
  const eventModule = createEventModule();
  const startlistModule = createStartlistModule();

  const databasePath = process.env.PUBLIC_PROJECTION_DB ?? path.join(process.cwd(), 'public-projection.sqlite3');
  const publicProjectionRepository = await SqlPublicProjectionRepository.initialize({ databasePath });

  const redisUrl = process.env.PUBLIC_PROJECTION_REDIS_URL;
  let redisClient: RedisClientType | undefined;
  let publicProjectionCache: PublicProjectionCache | undefined;

  if (redisUrl) {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (error) => {
      console.error('Public projection Redis error', error);
    });

    try {
      await redisClient.connect();
      publicProjectionCache = new PublicProjectionCache(redisClient);
    } catch (error) {
      console.error('Failed to connect to Redis for public projection cache', error);
    }
  }

  const cdnClient = createCdnClient();

  const publicProjectionSubscriber = new PublicProjectionSubscriber({
    repository: publicProjectionRepository,
    eventQueryService: eventModule.eventQueryService,
    startlistQueryService: startlistModule.queryService,
    cache: publicProjectionCache,
    cdnClient,
  });

  const server = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

  void server.register(cors, { origin: true });

  void server.register(entryRoutes, {
    useCases: entryModule.useCases,
    queryService: entryModule.queryService,
  });

  void server.register(eventRoutes, {
    createEventService: eventModule.createEventService,
    scheduleRaceService: eventModule.scheduleRaceService,
    eventQueryService: eventModule.eventQueryService,
    attachStartlistService: eventModule.attachStartlistService,
  });

  void server.register(startlistRoutes, {
    useCases: startlistModule.useCases,
    queryService: startlistModule.queryService,
  });

  void server.register(publicProjectionRoutes, {
    repository: publicProjectionRepository,
    cache: publicProjectionCache,
    cdnClient,
    eventQueryService: eventModule.eventQueryService,
    startlistQueryService: startlistModule.queryService,
  });

  if (redisClient) {
    server.addHook('onClose', async () => {
      await redisClient?.quit();
    });
  }

  const handleProjectionEvent = async (event: unknown) => {
    try {
      await publicProjectionSubscriber.handle(event);
    } catch (error) {
      server.log.error({ err: error, event }, 'Failed to project domain event');
    }
  };

  eventModule.domainEventBus.subscribe((event) => {
    void handleProjectionEvent(event);
  });

  startlistModule.domainEventBus.subscribe((event) => {
    void handleProjectionEvent(event);
  });

  const port = Number.parseInt(process.env.PORT ?? '3001', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await server.listen({ port, host });
  } catch (error) {
    server.log.error({ err: error }, 'Failed to start EntryManagement HTTP server');
    process.exit(1);
  }
};

function createCdnClient(): PublicProjectionCdnClient | undefined {
  const endpoint = process.env.PUBLIC_PROJECTION_CDN_PURGE_URL;
  if (!endpoint) {
    return undefined;
  }

  return new HttpPublicProjectionCdnClient({
    endpoint,
    authorizationToken: process.env.PUBLIC_PROJECTION_CDN_PURGE_TOKEN,
  });
}

void start();
