import { DomainError } from '../common/DomainError';

export class StartTime {
  private constructor(
    public readonly playerId: string,
    public readonly startTime: Date,
    public readonly laneNumber: number,
  ) {
    Object.freeze(this);
  }

  static create(params: { playerId: string; startTime: Date; laneNumber: number }): StartTime {
    const { playerId, startTime, laneNumber } = params;
    if (!playerId || playerId.trim().length === 0) {
      throw new DomainError('playerId is required.');
    }
    if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
      throw new DomainError('startTime must be a valid Date.');
    }
    if (!Number.isInteger(laneNumber) || laneNumber < 1) {
      throw new DomainError('laneNumber must be a positive integer.');
    }
    return new StartTime(playerId, new Date(startTime.getTime()), laneNumber);
  }
}
