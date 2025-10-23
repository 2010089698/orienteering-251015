import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyBaseLogger, FastifyReply } from 'fastify';
import type { Static } from '@sinclair/typebox';
import {
  AttachStartlistService,
  CreateEventService,
  EventNotFoundError,
  EventQueryService,
  PersistenceError,
  RaceNotFoundError,
  ScheduleRaceService,
  ValidationError,
  EventApplicationError,
  StartlistSyncError,
} from '@event-management/application';

import {
  AttachStartlistBodySchema,
  CreateEventBodySchema,
  ErrorResponseSchema,
  EventIdParamsSchema,
  EventListResponseSchema,
  EventRaceParamsSchema,
  EventResponseSchema,
  ScheduleRaceBodySchema,
} from './schemas.js';

export interface EventRoutesOptions {
  createEventService: CreateEventService;
  scheduleRaceService: ScheduleRaceService;
  eventQueryService: EventQueryService;
  attachStartlistService: AttachStartlistService;
}

type CreateEventBody = Static<typeof CreateEventBodySchema>;
type ScheduleRaceBody = Static<typeof ScheduleRaceBodySchema>;
type EventParams = Static<typeof EventIdParamsSchema>;
type EventRaceParams = Static<typeof EventRaceParamsSchema>;
type AttachStartlistBody = Static<typeof AttachStartlistBodySchema>;

type EventResponse = Static<typeof EventResponseSchema>;
type EventListResponse = Static<typeof EventListResponseSchema>;
type ErrorResponse = Static<typeof ErrorResponseSchema>;

const errorResponses = {
  400: ErrorResponseSchema,
  404: ErrorResponseSchema,
  500: ErrorResponseSchema,
  502: ErrorResponseSchema,
} as const;

const eventRoutes: FastifyPluginAsyncTypebox<EventRoutesOptions> = async (
  fastify,
  options,
) => {
  fastify.post<{ Body: CreateEventBody; Reply: EventResponse | ErrorResponse }>(
    '/api/events',
    {
      schema: {
        body: CreateEventBodySchema,
        response: { 201: EventResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      try {
        const event = await options.createEventService.execute(request.body);
        reply.code(201);
        return { event } satisfies EventResponse;
      } catch (error) {
        return handleServiceError(error, reply, fastify.log);
      }
    },
  );

  fastify.get<{ Params: EventParams; Reply: EventResponse | ErrorResponse }>(
    '/api/events/:eventId',
    {
      schema: {
        params: EventIdParamsSchema,
        response: { 200: EventResponseSchema, 404: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const event = await options.eventQueryService.getById(request.params.eventId);
        if (!event) {
          reply.code(404);
          return { message: `Event ${request.params.eventId} was not found.` } satisfies ErrorResponse;
        }
        reply.code(200);
        return { event } satisfies EventResponse;
      } catch (error) {
        return handleServiceError(error, reply, fastify.log);
      }
    },
  );

  fastify.get<{ Reply: EventListResponse }>(
    '/api/events',
    {
      schema: {
        response: { 200: EventListResponseSchema },
      },
    },
    async () => {
      const events = await options.eventQueryService.listAll();
      return { events } satisfies EventListResponse;
    },
  );

  fastify.post<{
    Params: EventParams;
    Body: ScheduleRaceBody;
    Reply: EventResponse | ErrorResponse;
  }>(
    '/api/events/:eventId/races',
    {
      schema: {
        params: EventIdParamsSchema,
        body: ScheduleRaceBodySchema,
        response: { 200: EventResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      try {
        const command = {
          ...request.body,
          eventId: request.params.eventId,
        };
        const event = await options.scheduleRaceService.execute(command);
        reply.code(200);
        return { event } satisfies EventResponse;
      } catch (error) {
        return handleServiceError(error, reply, fastify.log);
      }
    },
  );

  fastify.post<{
    Params: EventRaceParams;
    Body: AttachStartlistBody;
    Reply: EventResponse | ErrorResponse;
  }>(
    '/api/events/:eventId/races/:raceId/startlist',
    {
      schema: {
        params: EventRaceParamsSchema,
        body: AttachStartlistBodySchema,
        response: { 200: EventResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      try {
        const command = {
          ...request.body,
          eventId: request.params.eventId,
          raceId: request.params.raceId,
        };
        const event = await options.attachStartlistService.execute(command);
        reply.code(200);
        return { event } satisfies EventResponse;
      } catch (error) {
        return handleServiceError(error, reply, fastify.log);
      }
    },
  );

};

export default eventRoutes;

function handleServiceError(
  error: unknown,
  reply: FastifyReply,
  logger: FastifyBaseLogger,
): ErrorResponse {
  if (error instanceof ValidationError) {
    reply.code(400);
    return { message: error.message } satisfies ErrorResponse;
  }

  if (error instanceof EventNotFoundError || error instanceof RaceNotFoundError) {
    reply.code(404);
    return { message: error.message } satisfies ErrorResponse;
  }

  if (error instanceof PersistenceError) {
    logger.error(error, 'Event persistence error');
    reply.code(500);
    return { message: error.message } satisfies ErrorResponse;
  }

  if (error instanceof StartlistSyncError) {
    logger.error(error, 'Startlist synchronization error');
    reply.code(502);
    return { message: 'Startlist synchronization service is unavailable.' } satisfies ErrorResponse;
  }

  if (error instanceof EventApplicationError) {
    reply.code(400);
    return { message: error.message } satisfies ErrorResponse;
  }

  logger.error(error, 'Unhandled event routes error');
  reply.code(500);
  return { message: 'Internal Server Error' } satisfies ErrorResponse;
}
