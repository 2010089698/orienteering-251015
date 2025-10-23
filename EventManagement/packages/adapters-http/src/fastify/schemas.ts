import { Type } from '@sinclair/typebox';
import {
  CreateEventCommandSchema,
  EventDtoSchema,
  EventIdSchema,
  ScheduleRaceCommandSchema,
} from '@event-management/application';

export const EventIdParamsSchema = Type.Object(
  { eventId: EventIdSchema },
  { additionalProperties: false },
);

export const CreateEventBodySchema = CreateEventCommandSchema;
export const ScheduleRaceBodySchema = Type.Omit(ScheduleRaceCommandSchema, ['eventId']);

export const EventResponseSchema = Type.Object(
  { event: EventDtoSchema },
  { additionalProperties: false },
);

export const EventListResponseSchema = Type.Object(
  { events: Type.Array(EventDtoSchema) },
  { additionalProperties: false },
);

export const ErrorResponseSchema = Type.Object(
  { message: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);
