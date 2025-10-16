import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Static } from '@sinclair/typebox';
import {
  AssignLaneOrderBodySchema,
  AssignPlayerOrderBodySchema,
  AssignStartTimesBodySchema,
  InvalidateStartTimesBodySchema,
  ManualClassOrderBodySchema,
  ManualLaneOrderBodySchema,
  StartlistIdParamsSchema,
  StartlistResponseSchema,
  StartlistSettingsSchema,
} from './schemas.js';
import { toEnterStartlistSettingsCommand, toStartlistHttpResponse } from './mappers.js';
import {
  AssignLaneOrderUseCase,
  AssignPlayerOrderUseCase,
  AssignStartTimesUseCase,
  EnterStartlistSettingsUseCase,
  FinalizeStartlistUseCase,
  InvalidateStartTimesUseCase,
  ManuallyFinalizeClassStartOrderUseCase,
  ManuallyReassignLaneOrderUseCase,
  StartlistQueryService,
  InvalidCommandError,
  PersistenceError,
  StartlistApplicationError,
  StartlistNotFoundError,
} from '@startlist-management/application';

export interface StartlistRoutesOptions {
  useCases: {
    enterStartlistSettings: EnterStartlistSettingsUseCase;
    assignLaneOrder: AssignLaneOrderUseCase;
    assignPlayerOrder: AssignPlayerOrderUseCase;
    assignStartTimes: AssignStartTimesUseCase;
    finalizeStartlist: FinalizeStartlistUseCase;
    manuallyReassignLaneOrder: ManuallyReassignLaneOrderUseCase;
    manuallyFinalizeClassStartOrder: ManuallyFinalizeClassStartOrderUseCase;
    invalidateStartTimes: InvalidateStartTimesUseCase;
  };
  queryService: StartlistQueryService;
}

type StartlistParams = Static<typeof StartlistIdParamsSchema>;
type StartlistSettingsBody = Static<typeof StartlistSettingsSchema>;
type AssignLaneOrderBody = Static<typeof AssignLaneOrderBodySchema>;
type AssignPlayerOrderBody = Static<typeof AssignPlayerOrderBodySchema>;
type AssignStartTimesBody = Static<typeof AssignStartTimesBodySchema>;
type ManualLaneOrderBody = Static<typeof ManualLaneOrderBodySchema>;
type ManualClassOrderBody = Static<typeof ManualClassOrderBodySchema>;
type InvalidateStartTimesBody = Static<typeof InvalidateStartTimesBodySchema>;

type ErrorPayload = {
  statusCode: number;
  error: string;
  message: string;
};

const buildErrorResponse = (statusCode: number, message: string): ErrorPayload => {
  const errorTitles: Record<number, string> = {
    400: 'Bad Request',
    404: 'Not Found',
    503: 'Service Unavailable',
    500: 'Internal Server Error',
  };
  return {
    statusCode,
    error: errorTitles[statusCode] ?? 'Internal Server Error',
    message,
  };
};

const startlistRoutes: FastifyPluginAsyncTypebox<StartlistRoutesOptions> = async (fastify, options) => {
  const { useCases, queryService } = options;

  fastify.setErrorHandler((error, request, reply) => {
    if ((error as any).validation) {
      const payload = buildErrorResponse(400, error.message);
      reply.status(payload.statusCode).send(payload);
      return;
    }

    if (error instanceof StartlistNotFoundError) {
      const payload = buildErrorResponse(404, error.message);
      reply.status(payload.statusCode).send(payload);
      return;
    }

    if (error instanceof InvalidCommandError) {
      const payload = buildErrorResponse(400, error.message);
      reply.status(payload.statusCode).send(payload);
      return;
    }

    if (error instanceof PersistenceError) {
      const payload = buildErrorResponse(503, error.message);
      reply.status(payload.statusCode).send(payload);
      return;
    }

    if (error instanceof StartlistApplicationError) {
      const payload = buildErrorResponse(500, error.message);
      reply.status(payload.statusCode).send(payload);
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');
    const payload = buildErrorResponse(500, 'Unexpected server error');
    reply.status(payload.statusCode).send(payload);
  });

  fastify.post<{ Params: StartlistParams; Body: StartlistSettingsBody }>(
    '/api/startlists/:id/settings',
    {
      schema: {
        params: StartlistIdParamsSchema,
        body: StartlistSettingsSchema,
        response: { 200: StartlistResponseSchema },
      },
    },
    async (request) => {
      const command = toEnterStartlistSettingsCommand(request.params.id, request.body);
      const snapshot = await useCases.enterStartlistSettings.execute(command);
      return toStartlistHttpResponse(snapshot);
    },
  );

  fastify.post<{ Params: StartlistParams; Body: AssignLaneOrderBody }>(
    '/api/startlists/:id/lane-order',
    {
      schema: {
        params: StartlistIdParamsSchema,
        body: AssignLaneOrderBodySchema,
        response: { 200: StartlistResponseSchema },
      },
    },
    async (request) => {
      const command = {
        startlistId: request.params.id,
        assignments: request.body.assignments,
      };
      const snapshot = await useCases.assignLaneOrder.execute(command);
      return toStartlistHttpResponse(snapshot);
    },
  );

  fastify.post<{ Params: StartlistParams; Body: AssignPlayerOrderBody }>(
    '/api/startlists/:id/player-order',
    {
      schema: {
        params: StartlistIdParamsSchema,
        body: AssignPlayerOrderBodySchema,
        response: { 200: StartlistResponseSchema },
      },
    },
    async (request) => {
      const command = {
        startlistId: request.params.id,
        assignments: request.body.assignments,
      };
      const snapshot = await useCases.assignPlayerOrder.execute(command);
      return toStartlistHttpResponse(snapshot);
    },
  );

  fastify.post<{ Params: StartlistParams; Body: AssignStartTimesBody }>(
    '/api/startlists/:id/start-times',
    {
      schema: {
        params: StartlistIdParamsSchema,
        body: AssignStartTimesBodySchema,
        response: { 200: StartlistResponseSchema },
      },
    },
    async (request) => {
      const command = {
        startlistId: request.params.id,
        startTimes: request.body.startTimes,
      };
      const snapshot = await useCases.assignStartTimes.execute(command);
      return toStartlistHttpResponse(snapshot);
    },
  );

  fastify.post<{ Params: StartlistParams }>(
    '/api/startlists/:id/finalize',
    {
      schema: {
        params: StartlistIdParamsSchema,
        response: { 200: StartlistResponseSchema },
      },
    },
    async (request) => {
      const command = { startlistId: request.params.id };
      const snapshot = await useCases.finalizeStartlist.execute(command);
      return toStartlistHttpResponse(snapshot);
    },
  );

  fastify.post<{ Params: StartlistParams; Body: ManualLaneOrderBody }>(
    '/api/startlists/:id/lane-order/manual',
    {
      schema: {
        params: StartlistIdParamsSchema,
        body: ManualLaneOrderBodySchema,
        response: { 200: StartlistResponseSchema },
      },
    },
    async (request) => {
      const command = {
        startlistId: request.params.id,
        assignments: request.body.assignments,
        reason: request.body.reason,
      };
      const snapshot = await useCases.manuallyReassignLaneOrder.execute(command);
      return toStartlistHttpResponse(snapshot);
    },
  );

  fastify.post<{ Params: StartlistParams; Body: ManualClassOrderBody }>(
    '/api/startlists/:id/class-order/manual',
    {
      schema: {
        params: StartlistIdParamsSchema,
        body: ManualClassOrderBodySchema,
        response: { 200: StartlistResponseSchema },
      },
    },
    async (request) => {
      const command = {
        startlistId: request.params.id,
        assignments: request.body.assignments,
        reason: request.body.reason,
      };
      const snapshot = await useCases.manuallyFinalizeClassStartOrder.execute(command);
      return toStartlistHttpResponse(snapshot);
    },
  );

  fastify.post<{ Params: StartlistParams; Body: InvalidateStartTimesBody }>(
    '/api/startlists/:id/start-times/invalidate',
    {
      schema: {
        params: StartlistIdParamsSchema,
        body: InvalidateStartTimesBodySchema,
        response: { 200: StartlistResponseSchema },
      },
    },
    async (request) => {
      const command = {
        startlistId: request.params.id,
        reason: request.body.reason,
      };
      const snapshot = await useCases.invalidateStartTimes.execute(command);
      return toStartlistHttpResponse(snapshot);
    },
  );

  fastify.get<{ Params: StartlistParams }>(
    '/api/startlists/:id',
    {
      schema: {
        params: StartlistIdParamsSchema,
        response: { 200: StartlistResponseSchema },
      },
    },
    async (request) => {
      const query = { startlistId: request.params.id };
      const snapshot = await queryService.execute(query);
      return toStartlistHttpResponse(snapshot);
    },
  );
};

export default startlistRoutes;
