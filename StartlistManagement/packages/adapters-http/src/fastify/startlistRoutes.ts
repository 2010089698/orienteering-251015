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
  StartlistVersionListResponseSchema,
  StartlistDiffResponseSchema,
  StartlistVersionListQuerySchema,
  StartlistDiffQuerySchema,
  StartlistQueryOptionsSchema,
  StartlistCreateBodySchema,
  StartlistCreateResponseSchema,
} from './schemas.js';
import { toEnterStartlistSettingsCommand, toStartlistHttpResponse } from './mappers.js';
import {
  AssignLaneOrderUseCase,
  AssignPlayerOrderUseCase,
  AssignStartTimesUseCase,
  CreateStartlistForRaceUseCase,
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
  StartlistVersionNotFoundError,
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
    createStartlistForRace: CreateStartlistForRaceUseCase;
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
type StartlistQueryOptions = Static<typeof StartlistQueryOptionsSchema>;
type StartlistVersionListQuery = Static<typeof StartlistVersionListQuerySchema>;
type StartlistDiffQuery = Static<typeof StartlistDiffQuerySchema>;
type StartlistCreateBody = Static<typeof StartlistCreateBodySchema>;
type JapanRankingParams = { categoryId: string; page: string };

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

    if (error instanceof StartlistNotFoundError || error instanceof StartlistVersionNotFoundError) {
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

  fastify.post<{ Body: StartlistCreateBody }>(
    '/api/startlists',
    {
      schema: {
        body: StartlistCreateBodySchema,
        response: {
          200: StartlistCreateResponseSchema,
          201: StartlistCreateResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { eventId, raceId, schedule, updatedAt } = request.body;
      const result = await useCases.createStartlistForRace.execute({
        startlistId: raceId,
        eventId,
        raceId,
        schedule: {
          start: new Date(schedule.start),
          end: schedule.end ? new Date(schedule.end) : undefined,
        },
        updatedAt: updatedAt ? new Date(updatedAt) : undefined,
      });
      const snapshot = toStartlistHttpResponse(result.snapshot);
      const status = result.created ? 201 : 200;
      return reply.status(status).send({
        startlistId: result.startlistId,
        created: result.created,
        snapshot,
      });
    },
  );

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

  fastify.get<{ Params: JapanRankingParams }>(
    '/api/japan-ranking/:categoryId/:page',
    async (request, reply) => {
      const fetchImpl = globalThis.fetch;
      if (typeof fetchImpl !== 'function') {
        request.log.error('Fetch API is not available in this environment.');
        reply.status(503).send('Failed to reach upstream Japan ranking service.');
        return;
      }

      const upstreamUrl = `https://japan-o-entry.com/ranking/ranking/ranking_index/${encodeURIComponent(
        request.params.categoryId,
      )}/${encodeURIComponent(request.params.page)}`;

      try {
        const response = await fetchImpl(upstreamUrl);
        const body = await response.text();
        const contentType = response.headers.get('content-type') ?? 'text/html; charset=utf-8';

        reply.header('content-type', contentType).status(response.status).send(body);
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch Japan ranking data from upstream.');
        reply.status(502).send('Failed to fetch Japan ranking data from upstream.');
      }
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

  fastify.get<{ Params: StartlistParams; Querystring: StartlistQueryOptions }>(
    '/api/startlists/:id',
    {
      schema: {
        params: StartlistIdParamsSchema,
        querystring: StartlistQueryOptionsSchema,
        response: { 200: StartlistResponseSchema },
      },
    },
    async (request) => {
      const query = {
        startlistId: request.params.id,
        includeVersions: request.query.includeVersions,
        versionLimit: request.query.versionLimit,
        includeDiff: request.query.includeDiff,
        diffFromVersion: request.query.diffFromVersion,
        diffToVersion: request.query.diffToVersion,
      };
      const snapshot = await queryService.execute(query);
      return toStartlistHttpResponse(snapshot);
    },
  );

  fastify.get<{ Params: StartlistParams; Querystring: StartlistVersionListQuery }>(
    '/api/startlists/:id/versions',
    {
      schema: {
        params: StartlistIdParamsSchema,
        querystring: StartlistVersionListQuerySchema,
        response: { 200: StartlistVersionListResponseSchema },
      },
    },
    async (request) => {
      const result = await queryService.listVersions({
        startlistId: request.params.id,
        limit: request.query.limit,
        offset: request.query.offset,
      });
      return {
        startlistId: result.startlistId,
        total: result.total,
        items: result.items.map((item) => ({
          version: item.version,
          confirmedAt: item.confirmedAt,
          snapshot: toStartlistHttpResponse(item.snapshot),
        })),
      };
    },
  );

  fastify.get<{ Params: StartlistParams; Querystring: StartlistDiffQuery }>(
    '/api/startlists/:id/diff',
    {
      schema: {
        params: StartlistIdParamsSchema,
        querystring: StartlistDiffQuerySchema,
        response: { 200: StartlistDiffResponseSchema },
      },
    },
    async (request) => {
      const diff = await queryService.diff({
        startlistId: request.params.id,
        fromVersion: request.query.fromVersion,
        toVersion: request.query.toVersion,
      });
      if (!diff) {
        throw new StartlistVersionNotFoundError(request.params.id, request.query.toVersion ?? 1);
      }
      return diff;
    },
  );
};

export default startlistRoutes;
