export class StartlistLink {
  private constructor(private readonly value: string) {}

  public static from(value: string): StartlistLink {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new Error('Startlist link cannot be empty.');
    }

    try {
      // eslint-disable-next-line no-new
      new URL(trimmed);
    } catch {
      throw new Error('Startlist link must be a valid URL.');
    }

    return new StartlistLink(trimmed);
  }

  public toString(): string {
    return this.value;
  }
}
