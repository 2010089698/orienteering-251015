import { StartlistReference, RaceSchedulingService } from '@event-management/domain';
import { type StartlistSyncPort } from '../ports/StartlistSyncPort.js';

import { validateWithSchema } from '../../shared/validation.js';
import { mapEventToDto, mapToScheduleRaceInput } from '../dto/EventMappers.js';
import { type EventDto } from '../dto/EventDtos.js';
import { ScheduleRaceCommandSchema } from '../dto/EventSchemas.js';
import { EventServiceBase, type EventServiceDependencies } from './EventServiceBase.js';

export interface ScheduleRaceServiceDependencies extends EventServiceDependencies {
  raceSchedulingService: RaceSchedulingService;
  startlistSyncPort?: StartlistSyncPort;
}

export class ScheduleRaceService extends EventServiceBase {
  private readonly raceSchedulingService: RaceSchedulingService;
  private readonly startlistSyncPort?: StartlistSyncPort;

  constructor(deps: ScheduleRaceServiceDependencies) {
    super(deps.repository, deps.transactionManager, deps.eventPublisher);
    this.raceSchedulingService = deps.raceSchedulingService;
    this.startlistSyncPort = deps.startlistSyncPort;
  }

  async execute(payload: unknown): Promise<EventDto> {
    const command = validateWithSchema(ScheduleRaceCommandSchema, payload);
    const scheduleInput = mapToScheduleRaceInput(command);
    const event = await this.withEvent(command.eventId, async (eventAggregate) => {
      const race = eventAggregate.scheduleRace(scheduleInput, this.raceSchedulingService);

      if (!this.startlistSyncPort) {
        return;
      }

      const { startlistId, status } = await this.startlistSyncPort.createStartlist({
        eventId: eventAggregate.getId(),
        raceId: race.getId(),
        schedule: race.getSchedule(),
        updatedAt: new Date(),
      });

      const reference = StartlistReference.create({ startlistId, status });
      eventAggregate.attachStartlistReference(race.getId(), reference);
    });
    return mapEventToDto(event);
  }
}
