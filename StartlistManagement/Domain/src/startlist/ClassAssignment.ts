import { DomainError } from '../common/DomainError';
import { Duration } from './Duration';

export class ClassAssignment {
  private constructor(
    public readonly classId: string,
    public readonly playerOrder: ReadonlyArray<string>,
    public readonly interval: Duration,
  ) {
    Object.freeze(this);
  }

  static create(params: {
    classId: string;
    playerOrder: string[];
    interval: Duration;
  }): ClassAssignment {
    const { classId, playerOrder, interval } = params;
    if (!classId || classId.trim().length === 0) {
      throw new DomainError('classId is required.');
    }
    if (!Array.isArray(playerOrder) || playerOrder.length === 0) {
      throw new DomainError('playerOrder must contain at least one player identifier.');
    }
    const seen = new Set<string>();
    playerOrder.forEach((player) => {
      if (seen.has(player)) {
        throw new DomainError('playerOrder cannot contain duplicates.');
      }
      seen.add(player);
    });
    return new ClassAssignment(classId, [...playerOrder], interval);
  }
}
