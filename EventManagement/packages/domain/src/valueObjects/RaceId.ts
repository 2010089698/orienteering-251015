import { nanoid } from 'nanoid';

export class RaceId {
  private constructor(private readonly value: string) {}

  public static generate(): RaceId {
    return new RaceId(nanoid());
  }

  public static from(value: string): RaceId {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new Error('RaceId cannot be empty.');
    }

    return new RaceId(trimmed);
  }

  public equals(other: RaceId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
