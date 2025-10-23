import { createEventModule } from '@event-management/infrastructure';
import { createServer } from '@event-management/adapters-http/server';

const start = async () => {
  const startlistSyncBaseUrl = process.env.STARTLIST_SYNC_BASE_URL;

  const eventModule = createEventModule({
    startlistSync: startlistSyncBaseUrl ? { baseUrl: startlistSyncBaseUrl } : undefined,
  });

  const server = createServer({
    events: {
      createEventService: eventModule.createEventService,
      scheduleRaceService: eventModule.scheduleRaceService,
      eventQueryService: eventModule.eventQueryService,
    },
    logger: true,
  });

  const port = Number.parseInt(process.env.PORT ?? '3002', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await server.listen({ port, host });
  } catch (error) {
    server.log.error({ err: error }, 'Failed to start EventManagement HTTP server');
    process.exit(1);
  }
};

void start();
