import { DomainError } from '../common/DomainError.js';
import { Duration } from './Duration.js';

export class StartlistSettings {
  private constructor(
    public readonly eventId: string,
    public readonly startTime: Date,
    public readonly laneClassInterval: Duration,
    public readonly classPlayerInterval: Duration,
    public readonly laneCount: number,
  ) {
    Object.freeze(this);
  }

  static create(params: {
    eventId: string;
    startTime: Date;
    laneClassInterval?: Duration;
    classPlayerInterval?: Duration;
    laneCount: number;
    /**
     * @deprecated Legacy interval support. Use laneClassInterval/classPlayerInterval instead.
     */
    interval?: Duration;
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
    const laneClassInterval = params.laneClassInterval ?? params.interval;
    const classPlayerInterval = params.classPlayerInterval ?? params.interval;

    if (!laneClassInterval || !classPlayerInterval) {
      throw new DomainError('Both laneClassInterval and classPlayerInterval are required.');
    }

    return new StartlistSettings(
      params.eventId,
      new Date(params.startTime.getTime()),
      laneClassInterval,
      classPlayerInterval,
      params.laneCount,
    );
  }
}
