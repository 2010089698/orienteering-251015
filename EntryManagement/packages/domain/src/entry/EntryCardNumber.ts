import { DomainError } from '../common/DomainError.js';

const CARD_NUMBER_PATTERN = /^\d+$/;

export class EntryCardNumber {
  private constructor(private readonly _value: string) {}

  static create(value: string): EntryCardNumber {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new DomainError('EntryCardNumber must not be empty');
    }

    if (!CARD_NUMBER_PATTERN.test(trimmed)) {
      throw new DomainError('EntryCardNumber must contain only digits');
    }

    return new EntryCardNumber(trimmed);
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }
}
