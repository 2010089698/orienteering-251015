import { DomainError } from '../common/DomainError.js';
import { Duration } from './Duration.js';

export class LaneAssignment {
  private constructor(
    public readonly laneNumber: number,
    public readonly classOrder: ReadonlyArray<string>,
    public readonly interval: Duration,
  ) {
    Object.freeze(this);
  }

  static create(params: {
    laneNumber: number;
    classOrder: string[];
    interval: Duration;
    laneCount: number;
  }): LaneAssignment {
    const { laneNumber, classOrder, interval, laneCount } = params;
    if (!Number.isInteger(laneNumber) || laneNumber < 1 || laneNumber > laneCount) {
      throw new DomainError(`laneNumber must be within 1 and laneCount (${laneCount}).`);
    }
    if (!Array.isArray(classOrder) || classOrder.length === 0) {
      throw new DomainError('classOrder must contain at least one class identifier.');
    }
    const seen = new Set<string>();
    classOrder.forEach((cls) => {
      if (seen.has(cls)) {
        throw new DomainError('classOrder cannot contain duplicates within the same lane.');
      }
      seen.add(cls);
    });
    return new LaneAssignment(laneNumber, [...classOrder], interval);
  }
}
