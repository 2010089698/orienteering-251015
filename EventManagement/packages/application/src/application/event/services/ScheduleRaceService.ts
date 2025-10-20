import { RaceSchedulingService } from '@event-management/domain';

import { validateWithSchema } from '../../shared/validation.js';
import { mapEventToDto, mapToScheduleRaceInput } from '../dto/EventMappers.js';
import { type EventDto } from '../dto/EventDtos.js';
import { ScheduleRaceCommandSchema } from '../dto/EventSchemas.js';
import { EventServiceBase, type EventServiceDependencies } from './EventServiceBase.js';

export interface ScheduleRaceServiceDependencies extends EventServiceDependencies {
  raceSchedulingService: RaceSchedulingService;
}

export class ScheduleRaceService extends EventServiceBase {
  private readonly raceSchedulingService: RaceSchedulingService;

  constructor(deps: ScheduleRaceServiceDependencies) {
    super(deps.repository, deps.transactionManager, deps.eventPublisher);
    this.raceSchedulingService = deps.raceSchedulingService;
  }

  async execute(payload: unknown): Promise<EventDto> {
    const command = validateWithSchema(ScheduleRaceCommandSchema, payload);
    const scheduleInput = mapToScheduleRaceInput(command);
    const event = await this.withEvent(command.eventId, (eventAggregate) => {
      eventAggregate.scheduleRace(scheduleInput, this.raceSchedulingService);
    });
    return mapEventToDto(event);
  }
}
