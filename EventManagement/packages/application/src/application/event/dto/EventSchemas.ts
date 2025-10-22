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
    startlistId: Type.String({ minLength: 1 }),
    startlistLink: Type.Optional(Type.String({ minLength: 1 })),
    startlistUpdatedAt: Type.Optional(DateTimeString),
    startlistPublicVersion: Type.Optional(Type.Integer({ minimum: 1 })),
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
    startlistId: Type.Optional(Type.String({ minLength: 1 })),
    startlistLink: Type.Optional(Type.String({ minLength: 1 })),
    startlistUpdatedAt: Type.Optional(DateTimeString),
    startlistPublicVersion: Type.Optional(Type.Integer({ minimum: 1 })),
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
