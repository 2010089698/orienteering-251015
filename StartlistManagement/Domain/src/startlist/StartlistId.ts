import { DomainError } from '../common/DomainError.js';

export class StartlistId {
  private constructor(private readonly value: string) {}

  static create(raw: string): StartlistId {
    if (!raw || raw.trim().length === 0) {
      throw new DomainError('StartlistId cannot be empty.');
    }
    return new StartlistId(raw);
  }

  toString(): string {
    return this.value;
  }

  equals(other: StartlistId): boolean {
    return this.value === other.value;
  }
}
