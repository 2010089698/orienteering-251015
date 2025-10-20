function ensureDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new Error(`${label} must be a valid Date.`);
  }
  return value;
}

export class RaceSchedule {
  private constructor(private readonly start: Date, private readonly end?: Date) {}

  public static from(start: Date, end?: Date): RaceSchedule {
    const startDate = ensureDate(start, 'Race start');
    if (end) {
      const endDate = ensureDate(end, 'Race end');
      if (startDate.getTime() > endDate.getTime()) {
        throw new Error('Race start must be before race end.');
      }
      return new RaceSchedule(new Date(startDate), new Date(endDate));
    }

    return new RaceSchedule(new Date(startDate));
  }

  public getStart(): Date {
    return new Date(this.start);
  }

  public getEnd(): Date | undefined {
    return this.end ? new Date(this.end) : undefined;
  }

  public occursOnSameDay(date: Date): boolean {
    const target = ensureDate(date, 'Date');
    return this.start.toDateString() === target.toDateString();
  }

  public occursOnSameDayAs(other: RaceSchedule): boolean {
    return this.start.toDateString() === other.start.toDateString();
  }

  public overlapsWith(other: RaceSchedule): boolean {
    const thisEnd = this.end?.getTime() ?? this.start.getTime();
    const otherEnd = other.end?.getTime() ?? other.start.getTime();
    return this.start.getTime() <= otherEnd && other.start.getTime() <= thisEnd;
  }
}
