import { randomUUID } from 'node:crypto';

export class EntryId {
  private constructor(private readonly value: string) {}

  static create(value: string): EntryId {
    if (!value) {
      throw new Error('EntryId cannot be empty');
    }
    return new EntryId(value);
  }

  static generate(): EntryId {
    return new EntryId(randomUUID());
  }

  toString(): string {
    return this.value;
  }
}
