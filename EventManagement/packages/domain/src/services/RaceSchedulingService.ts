import type { Event } from '../event.js';
import type { Race } from '../race.js';
import { RaceSchedule } from '../valueObjects/RaceSchedule.js';

export interface RaceSchedulingResult {
  isDuplicateDay: boolean;
  overlapsExisting: boolean;
}

type SchedulableEvent = Pick<Event, 'getDateRange' | 'getRaces'>;

export class RaceSchedulingService {
  public validate(event: SchedulableEvent, schedule: RaceSchedule): RaceSchedulingResult {
    const start = schedule.getStart();
    if (!event.getDateRange().includes(start)) {
      throw new Error('Race schedule must fall within the event date range.');
    }

    const races = event.getRaces() as readonly Race[];
    const isDuplicateDay = races.some((race) => race.getSchedule().occursOnSameDayAs(schedule));
    const overlapsExisting = races.some((race) => race.getSchedule().overlapsWith(schedule));

    return {
      isDuplicateDay,
      overlapsExisting
    };
  }
}
