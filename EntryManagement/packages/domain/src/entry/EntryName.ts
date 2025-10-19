import { DomainError } from '../common/DomainError.js';

export class EntryName {
  private constructor(private readonly _value: string) {}

  static create(value: string): EntryName {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new DomainError('EntryName must not be empty');
    }

    return new EntryName(trimmed);
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }
}
