import { DomainError } from '../common/DomainError.js';

export class Duration {
  private constructor(private readonly milliseconds: number) {}

  static fromMilliseconds(milliseconds: number): Duration {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new DomainError('Duration must be a non-negative finite number of milliseconds.');
    }
    return new Duration(milliseconds);
  }

  static fromSeconds(seconds: number): Duration {
    return Duration.fromMilliseconds(seconds * 1000);
  }

  static fromMinutes(minutes: number): Duration {
    return Duration.fromMilliseconds(minutes * 60 * 1000);
  }

  get value(): number {
    return this.milliseconds;
  }

  equals(other: Duration): boolean {
    return this.milliseconds === other.milliseconds;
  }
}
