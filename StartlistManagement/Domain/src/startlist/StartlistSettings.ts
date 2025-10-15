import { DomainError } from '../common/DomainError';
import { Duration } from './Duration';

export class StartlistSettings {
  private constructor(
    public readonly eventId: string,
    public readonly startTime: Date,
    public readonly interval: Duration,
    public readonly laneCount: number,
  ) {
    Object.freeze(this);
  }

  static create(params: {
    eventId: string;
    startTime: Date;
    interval: Duration;
    laneCount: number;
  }): StartlistSettings {
    if (!params.eventId || params.eventId.trim().length === 0) {
      throw new DomainError('eventId is required.');
    }
    if (!(params.startTime instanceof Date) || isNaN(params.startTime.getTime())) {
      throw new DomainError('startTime must be a valid Date.');
    }
    if (params.laneCount < 1 || !Number.isInteger(params.laneCount)) {
      throw new DomainError('laneCount must be an integer greater than or equal to 1.');
    }
    return new StartlistSettings(
      params.eventId,
      new Date(params.startTime.getTime()),
      params.interval,
      params.laneCount,
    );
  }
}
