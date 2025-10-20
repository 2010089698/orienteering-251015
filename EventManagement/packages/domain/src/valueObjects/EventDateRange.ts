export class EventDateRange {
  private constructor(private readonly start: Date, private readonly end: Date) {}

  public static from(start: Date, end: Date): EventDateRange {
    if (!(start instanceof Date) || Number.isNaN(start.valueOf())) {
      throw new Error('Event start date must be a valid Date.');
    }

    if (!(end instanceof Date) || Number.isNaN(end.valueOf())) {
      throw new Error('Event end date must be a valid Date.');
    }

    if (start.getTime() > end.getTime()) {
      throw new Error('Event start date must be before end date.');
    }

    return new EventDateRange(new Date(start), new Date(end));
  }

  public includes(date: Date): boolean {
    const time = date.getTime();
    return this.start.getTime() <= time && time <= this.end.getTime();
  }

  public getStart(): Date {
    return new Date(this.start);
  }

  public getEnd(): Date {
    return new Date(this.end);
  }
}
