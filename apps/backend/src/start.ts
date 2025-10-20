import Fastify from 'fastify';
import cors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { entryRoutes } from '@entry-management/adapters-http';
import { createEntryModule } from '@entry-management/infrastructure/config/entryModule';
import { eventRoutes } from '@event-management/adapters-http';
import { createEventModule } from '@event-management/infrastructure';

const start = async () => {
  const entryModule = createEntryModule();
  const eventModule = createEventModule();

  const server = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

  void server.register(cors, { origin: true });

  void server.register(entryRoutes, {
    useCases: entryModule.useCases,
    queryService: entryModule.queryService,
  });

  void server.register(eventRoutes, {
    createEventService: eventModule.createEventService,
    scheduleRaceService: eventModule.scheduleRaceService,
    attachStartlistService: eventModule.attachStartlistService,
    eventQueryService: eventModule.eventQueryService,
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

void start();
