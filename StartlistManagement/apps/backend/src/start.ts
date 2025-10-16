import { createStartlistModule } from '@startlist-management/infrastructure/config/startlistModule';
import { createServer } from '@startlist-management/adapters-http/server';

const start = async () => {
  const startlistModule = createStartlistModule();
  const server = createServer({
    startlist: {
      useCases: startlistModule.useCases,
      queryService: startlistModule.queryService,
    },
    logger: true,
  });

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await server.listen({ port, host });
  } catch (error) {
    server.log.error({ err: error }, 'Failed to start StartlistManagement HTTP server');
    process.exit(1);
  }
};

void start();
