import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

import type { PublicProjectionRepository } from './repository.js';

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

type EventParams = Static<typeof EventIdParamsSchema>;
type EventRaceParams = Static<typeof EventRaceParamsSchema>;
type ErrorResponse = Static<typeof ErrorResponseSchema>;
type PublicEventResponse = Static<typeof PublicEventResponseSchema>;
type PublicEventListResponse = Static<typeof PublicEventListResponseSchema>;
type PublicStartlistResponse = Static<typeof PublicStartlistResponseSchema>;

export interface PublicProjectionRoutesOptions {
  repository: PublicProjectionRepository;
}

export const publicProjectionRoutes: FastifyPluginAsyncTypebox<PublicProjectionRoutesOptions> = async (
  fastify,
  options,
) => {
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
      const events = await options.repository.listEvents();
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
      const event = await options.repository.findEventById(request.params.eventId);
      if (!event) {
        reply.code(404);
        return { message: `Event ${request.params.eventId} was not found.` } satisfies ErrorResponse;
      }
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
      const result = await options.repository.findStartlistByRace(
        request.params.eventId,
        request.params.raceId,
      );
      if (!result) {
        reply.code(404);
        return {
          message: `Startlist for event ${request.params.eventId} and race ${request.params.raceId} was not found.`,
        } satisfies ErrorResponse;
      }
      return result satisfies PublicStartlistResponse;
    },
  );
};

export default publicProjectionRoutes;
