import { type Static } from '@sinclair/typebox';

import {
  CreateEventCommandSchema,
  EventDtoSchema,
  RaceDtoSchema,
  ScheduleRaceCommandSchema,
  AttachStartlistCommandSchema,
} from './EventSchemas.js';

export type CreateEventCommand = Static<typeof CreateEventCommandSchema>;
export type ScheduleRaceCommand = Static<typeof ScheduleRaceCommandSchema>;
export type AttachStartlistCommand = Static<typeof AttachStartlistCommandSchema>;

export type EventDto = Static<typeof EventDtoSchema>;
export type RaceDto = Static<typeof RaceDtoSchema>;
