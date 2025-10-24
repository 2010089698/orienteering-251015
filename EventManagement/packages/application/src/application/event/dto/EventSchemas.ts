import { Type } from '@sinclair/typebox';

export const EventIdSchema = Type.String({ minLength: 1 });
export const RaceIdSchema = Type.String({ minLength: 1 });
const NonEmptyString = Type.String({ minLength: 1 });
const DateTimeString = Type.String({ minLength: 1 });
const DateString = Type.String({ minLength: 1 });

export const CreateEventCommandSchema = Type.Object(
  {
    name: NonEmptyString,
    startDate: DateTimeString,
    endDate: DateTimeString,
    venue: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ScheduleRaceCommandSchema = Type.Object(
  {
    eventId: EventIdSchema,
    name: NonEmptyString,
    date: DateString,
  },
  { additionalProperties: false },
);

export const AttachStartlistCommandSchema = Type.Object(
  {
    eventId: EventIdSchema,
    raceId: RaceIdSchema,
    startlistId: NonEmptyString,
    confirmedAt: DateTimeString,
    version: Type.Integer({ minimum: 1 }),
    publicUrl: Type.Optional(NonEmptyString),
    status: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const RaceDtoSchema = Type.Object(
  {
    id: RaceIdSchema,
    name: NonEmptyString,
    schedule: Type.Object(
      {
        start: DateTimeString,
        end: Type.Optional(DateTimeString),
      },
      { additionalProperties: false },
    ),
    duplicateDay: Type.Boolean(),
    overlapsExisting: Type.Boolean(),
    startlist: Type.Optional(
      Type.Object(
        {
          id: Type.String({ minLength: 1 }),
          status: NonEmptyString,
          confirmedAt: Type.Optional(DateTimeString),
          publicVersion: Type.Optional(Type.Integer({ minimum: 1 })),
          publicUrl: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const EventDtoSchema = Type.Object(
  {
    id: EventIdSchema,
    name: NonEmptyString,
    startDate: DateTimeString,
    endDate: DateTimeString,
    venue: NonEmptyString,
    allowMultipleRacesPerDay: Type.Literal(true),
    allowScheduleOverlap: Type.Literal(true),
    races: Type.Array(RaceDtoSchema),
  },
  { additionalProperties: false },
);
