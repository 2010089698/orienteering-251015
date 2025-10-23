import { type Static } from '@sinclair/typebox';

import {
  CreateEventCommandSchema,
  EventDtoSchema,
  RaceDtoSchema,
  ScheduleRaceCommandSchema,
} from './EventSchemas.js';

export type CreateEventCommand = Static<typeof CreateEventCommandSchema>;
export type ScheduleRaceCommand = Static<typeof ScheduleRaceCommandSchema>;

export type EventDto = Static<typeof EventDtoSchema>;
export type RaceDto = Static<typeof RaceDtoSchema>;
