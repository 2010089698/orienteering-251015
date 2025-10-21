export interface SyncRaceScheduleCommand {
  eventId: string;
  raceId: string;
  schedule: {
    start: Date;
    end?: Date;
  };
  updatedAt: Date;
}

export interface SyncRaceScheduleUseCase {
  execute(command: SyncRaceScheduleCommand): Promise<void>;
}

/**
 * Placeholder implementation for synchronising race schedules with the startlist aggregate.
 *
 * The startlist aggregate does not yet expose behaviour for race schedule synchronisation.
 * Once the aggregate logic is available this service should be updated to perform the
 * necessary load/create/update workflow.
 */
export class SyncRaceScheduleService implements SyncRaceScheduleUseCase {
  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(_command: SyncRaceScheduleCommand): Promise<void> {
    // Intentionally left blank until the aggregate behaviour is implemented.
  }
}
