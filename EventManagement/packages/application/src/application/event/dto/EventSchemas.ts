import { Type } from '@sinclair/typebox';

export const EventIdSchema = Type.String({ minLength: 1 });
export const RaceIdSchema = Type.String({ minLength: 1 });
const NonEmptyString = Type.String({ minLength: 1 });
const DateTimeString = Type.String({ minLength: 1 });

export const CreateEventCommandSchema = Type.Object(
  {
    eventId: EventIdSchema,
    name: NonEmptyString,
    startDate: DateTimeString,
    endDate: DateTimeString,
    venue: NonEmptyString,
    allowMultipleRacesPerDay: Type.Optional(Type.Boolean()),
    allowScheduleOverlap: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const ScheduleRaceCommandSchema = Type.Object(
  {
    eventId: EventIdSchema,
    raceId: RaceIdSchema,
    name: NonEmptyString,
    start: DateTimeString,
    end: Type.Optional(DateTimeString),
  },
  { additionalProperties: false },
);

export const AttachStartlistCommandSchema = Type.Object(
  {
    eventId: EventIdSchema,
    raceId: RaceIdSchema,
    startlistLink: Type.String({ minLength: 1 }),
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
    startlistLink: Type.Optional(Type.String({ minLength: 1 })),
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
    allowMultipleRacesPerDay: Type.Boolean(),
    allowScheduleOverlap: Type.Boolean(),
    races: Type.Array(RaceDtoSchema),
  },
  { additionalProperties: false },
);
