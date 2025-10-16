import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Static, Type } from '@sinclair/typebox';
import {
  EntryQueryService,
  RegisterEntryUseCase,
} from '@entry-management/application';
import {
  EntryResponseSchema,
  EntrySummarySchema,
  RegisterEntryBodySchema,
} from './schemas.js';

export interface EntryRoutesOptions {
  useCases: {
    registerEntry: RegisterEntryUseCase;
  };
  queryService: EntryQueryService;
}

type RegisterEntryBody = Static<typeof RegisterEntryBodySchema>;

type ErrorPayload = {
  statusCode: number;
  error: string;
  message: string;
};

const buildErrorResponse = (statusCode: number, message: string): ErrorPayload => ({
  statusCode,
  error:
    statusCode === 400
      ? 'Bad Request'
      : statusCode === 404
        ? 'Not Found'
        : 'Internal Server Error',
  message,
});

const entryRoutes: FastifyPluginAsyncTypebox<EntryRoutesOptions> = async (fastify, options) => {
  const { useCases, queryService } = options;

  fastify.setErrorHandler((error, request, reply) => {
    if ((error as any).validation) {
      const payload = buildErrorResponse(400, error.message);
      reply.status(payload.statusCode).send(payload);
      return;
    }

    request.log.error({ err: error }, 'Unhandled entry management error');
    const payload = buildErrorResponse(500, 'Unexpected server error');
    reply.status(payload.statusCode).send(payload);
  });

  fastify.get(
    '/api/entries',
    {
      schema: {
        response: {
          200: Type.Array(EntrySummarySchema),
        },
      },
    },
    async () => {
      return queryService.listEntries();
    },
  );

  fastify.post<{ Body: RegisterEntryBody }>(
    '/api/entries',
    {
      schema: {
        body: RegisterEntryBodySchema,
        response: { 201: EntryResponseSchema },
      },
    },
    async (request, reply) => {
      const entry = await useCases.registerEntry.execute(request.body);
      reply.code(201);
      return entry;
    },
  );
};

export default entryRoutes;
