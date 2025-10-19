import { DomainError } from '../common/DomainError.js';

export class EntryClassId {
  private constructor(private readonly _value: string) {}

  static create(value: string): EntryClassId {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new DomainError('EntryClassId must not be empty');
    }

    return new EntryClassId(trimmed);
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }
}
