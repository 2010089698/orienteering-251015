import { createEntryModule } from '@entry-management/infrastructure/config/entryModule';
import { createServer } from '@entry-management/adapters-http/server';

const start = async () => {
  const entryModule = createEntryModule();
  const server = createServer({
    entry: {
      useCases: entryModule.useCases,
      queryService: entryModule.queryService,
    },
    logger: true,
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
