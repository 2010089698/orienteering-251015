import { nanoid } from 'nanoid';

export class EventId {
  private constructor(private readonly value: string) {}

  public static generate(): EventId {
    return new EventId(nanoid());
  }

  public static from(value: string): EventId {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new Error('EventId cannot be empty.');
    }

    return new EventId(trimmed);
  }

  public equals(other: EventId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
