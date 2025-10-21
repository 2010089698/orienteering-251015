import type { Event } from '../event.js';
import type { Race } from '../race.js';

export class EventPublicationPolicy {
  public ensureCanPublish(event: Pick<Event, 'getRaces'>): void {
    const races = event.getRaces() as readonly Race[];

    if (races.length === 0) {
      throw new Error('Event must contain at least one race before publication.');
    }

    const raceWithoutStartlist = races.find((race) => !race.hasPublishedStartlist());
    if (raceWithoutStartlist) {
      throw new Error('All races must have an associated startlist before publication.');
    }

    const overlappingRace = races.find((race) => race.hasScheduleOverlap());
    if (overlappingRace) {
      throw new Error('Event contains races with overlapping schedules.');
    }
  }
}
