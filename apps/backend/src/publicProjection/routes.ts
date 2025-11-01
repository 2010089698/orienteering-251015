import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

import type { EventQueryService } from '@event-management/application';
import type { StartlistQueryService } from '@startlist-management/application';

import type { PublicProjectionRepository } from './repository.js';
import type { PublicProjectionCache } from './cache/PublicProjectionCache.js';
import type { PublicProjectionCdnClient } from './cdn/HttpPublicProjectionCdnClient.js';
import type { PublicProjectionNotifier } from './rebuildOne.js';
import { ProjectionRebuildError, rebuildPublicProjectionRecord } from './rebuildOne.js';

const StartlistSnapshotSchema = Type.Unknown();

const PublicStartlistSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    eventId: Type.String({ minLength: 1 }),
    raceId: Type.String({ minLength: 1 }),
    status: Type.String({ minLength: 1 }),
    snapshot: StartlistSnapshotSchema,
    confirmedAt: Type.Optional(Type.String({ minLength: 1 })),
    createdAt: Type.String({ minLength: 1 }),
    updatedAt: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const PublicRaceSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    eventId: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    schedule: Type.Object(
      {
        start: Type.String({ minLength: 1 }),
        end: Type.Optional(Type.String({ minLength: 1 })),
      },
      { additionalProperties: false },
    ),
    duplicateDay: Type.Boolean(),
    overlapsExisting: Type.Boolean(),
    startlistId: Type.Optional(Type.String({ minLength: 1 })),
    createdAt: Type.String({ minLength: 1 }),
    updatedAt: Type.String({ minLength: 1 }),
    startlist: Type.Optional(PublicStartlistSchema),
  },
  { additionalProperties: false },
);

const PublicEventSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    startDate: Type.String({ minLength: 1 }),
    endDate: Type.String({ minLength: 1 }),
    venue: Type.String({ minLength: 1 }),
    allowMultipleRacesPerDay: Type.Boolean(),
    allowScheduleOverlap: Type.Boolean(),
    createdAt: Type.String({ minLength: 1 }),
    updatedAt: Type.String({ minLength: 1 }),
    races: Type.Array(PublicRaceSchema),
  },
  { additionalProperties: false },
);

const PublicStartlistVersionSchema = Type.Object(
  {
    startlistId: Type.String({ minLength: 1 }),
    version: Type.Integer({ minimum: 1 }),
    snapshot: StartlistSnapshotSchema,
    confirmedAt: Type.String({ minLength: 1 }),
    createdAt: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const EventIdParamsSchema = Type.Object(
  {
    eventId: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const EventRaceParamsSchema = Type.Object(
  {
    eventId: Type.String({ minLength: 1 }),
    raceId: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const ErrorResponseSchema = Type.Object(
  {
    message: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const PublicEventListResponseSchema = Type.Object(
  {
    events: Type.Array(PublicEventSchema),
  },
  { additionalProperties: false },
);

const PublicEventResponseSchema = Type.Object(
  {
    event: PublicEventSchema,
  },
  { additionalProperties: false },
);

const PublicStartlistResponseSchema = Type.Object(
  {
    startlist: PublicStartlistSchema,
    history: Type.Array(PublicStartlistVersionSchema),
  },
  { additionalProperties: false },
);

const CacheKeySchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal('event'),
      eventId: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('startlist'),
      eventId: Type.String({ minLength: 1 }),
      raceId: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
]);

type EventParams = Static<typeof EventIdParamsSchema>;
type EventRaceParams = Static<typeof EventRaceParamsSchema>;
type ErrorResponse = Static<typeof ErrorResponseSchema>;
type PublicEventResponse = Static<typeof PublicEventResponseSchema>;
type PublicEventListResponse = Static<typeof PublicEventListResponseSchema>;
type PublicStartlistResponse = Static<typeof PublicStartlistResponseSchema>;
type RebuildRequest = Static<typeof RebuildRequestSchema>;
type RebuildResponse = Static<typeof RebuildResponseSchema>;

const RebuildRequestSchema = Type.Object(
  {
    eventId: Type.Optional(Type.String({ minLength: 1 })),
    startlistId: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

const RebuildEventResultSchema = Type.Object(
  {
    type: Type.Literal('event'),
    event: PublicEventSchema,
    urls: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

const RebuildStartlistResultSchema = Type.Object(
  {
    type: Type.Literal('startlist'),
    eventId: Type.String({ minLength: 1 }),
    raceId: Type.String({ minLength: 1 }),
    startlistId: Type.String({ minLength: 1 }),
    startlist: PublicStartlistResponseSchema,
    urls: Type.Array(Type.String({ minLength: 1 })),
    diff: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

const RebuildResponseSchema = Type.Object(
  {
    result: Type.Union([RebuildEventResultSchema, RebuildStartlistResultSchema]),
    cacheKeys: Type.Array(CacheKeySchema),
  },
  { additionalProperties: false },
);

export interface PublicProjectionRoutesOptions {
  repository: PublicProjectionRepository;
  cache?: PublicProjectionCache;
  cdnClient?: PublicProjectionCdnClient;
  eventQueryService: EventQueryService;
  startlistQueryService: StartlistQueryService;
  notifier?: PublicProjectionNotifier;
}

export const publicProjectionRoutes: FastifyPluginAsyncTypebox<PublicProjectionRoutesOptions> = async (
  fastify,
  options,
) => {
  const { repository, cache, cdnClient, eventQueryService, startlistQueryService, notifier } = options;

  fastify.get<{ Reply: PublicEventListResponse }>(
    '/api/public/events',
    {
      schema: {
        response: {
          200: PublicEventListResponseSchema,
        },
      },
    },
    async () => {
      const events = await repository.listEvents();
      return { events } satisfies PublicEventListResponse;
    },
  );

  fastify.get<{ Params: EventParams; Reply: PublicEventResponse | ErrorResponse }>(
    '/api/public/events/:eventId',
    {
      schema: {
        params: EventIdParamsSchema,
        response: {
          200: PublicEventResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const cached = await cache?.getEvent(request.params.eventId);
      if (cached) {
        return { event: cached } satisfies PublicEventResponse;
      }

      const event = await repository.findEventById(request.params.eventId);
      if (!event) {
        reply.code(404);
        return { message: `Event ${request.params.eventId} was not found.` } satisfies ErrorResponse;
      }
      await cache?.setEvent(event);
      return { event } satisfies PublicEventResponse;
    },
  );

  fastify.get<{ Params: EventRaceParams; Reply: PublicStartlistResponse | ErrorResponse }>(
    '/api/public/events/:eventId/races/:raceId/startlist',
    {
      schema: {
        params: EventRaceParamsSchema,
        response: {
          200: PublicStartlistResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const cached = await cache?.getStartlist(request.params.eventId, request.params.raceId);
      if (cached) {
        return cached satisfies PublicStartlistResponse;
      }

      const result = await repository.findStartlistByRace(
        request.params.eventId,
        request.params.raceId,
      );
      if (!result) {
        reply.code(404);
        return {
          message: `Startlist for event ${request.params.eventId} and race ${request.params.raceId} was not found.`,
        } satisfies ErrorResponse;
      }
      await cache?.setStartlist(request.params.eventId, request.params.raceId, result);
      return result satisfies PublicStartlistResponse;
    },
  );

  fastify.post<{ Body: RebuildRequest; Reply: RebuildResponse | ErrorResponse }>(
    '/api/public/projection/rebuild',
    {
      schema: {
        body: RebuildRequestSchema,
        response: {
          200: RebuildResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { eventId, startlistId } = request.body;
      if ((eventId && startlistId) || (!eventId && !startlistId)) {
        reply.code(400);
        return { message: 'Provide either eventId or startlistId.' } satisfies ErrorResponse;
      }

      try {
        const result = await rebuildPublicProjectionRecord({
          repository,
          cache,
          cdnClient,
          notifier,
          eventQueryService,
          startlistQueryService,
          eventId: eventId ?? undefined,
          startlistId: startlistId ?? undefined,
          logger: fastify.log,
        });

        if (result.type === 'event') {
          return {
            result: {
              type: 'event',
              event: result.event,
              urls: result.urls,
            },
            cacheKeys: result.cacheKeys,
          };
        }

        return {
          result: {
            type: 'startlist',
            eventId: result.eventId,
            raceId: result.raceId,
            startlistId: result.startlistId,
            startlist: result.startlist,
            urls: result.urls,
            ...(result.diff ? { diff: result.diff } : {}),
          },
          cacheKeys: result.cacheKeys,
        };
      } catch (error) {
        if (error instanceof ProjectionRebuildError) {
          reply.code(404);
          return { message: error.message } satisfies ErrorResponse;
        }

        throw error;
      }
    },
  );
};

export default publicProjectionRoutes;
