import { RaceId } from './valueObjects/RaceId.js';
import { RaceSchedule } from './valueObjects/RaceSchedule.js';
import { StartlistLink } from './valueObjects/StartlistLink.js';

export interface RaceProps {
  id: RaceId;
  name: string;
  schedule: RaceSchedule;
  isDuplicateDay?: boolean;
  overlapsExisting?: boolean;
  startlistLink?: StartlistLink;
  startlistUpdatedAt?: Date;
  startlistPublicVersion?: number;
}

export class Race {
  private startlistLink?: StartlistLink;
  private startlistUpdatedAt?: Date;
  private startlistPublicVersion?: number;

  private constructor(
    private readonly id: RaceId,
    private readonly name: string,
    private readonly schedule: RaceSchedule,
    private readonly isDuplicateDay: boolean,
    private readonly overlapsExisting: boolean,
    startlistLink?: StartlistLink,
    startlistUpdatedAt?: Date,
    startlistPublicVersion?: number
  ) {
    this.startlistLink = startlistLink;
    this.startlistUpdatedAt = startlistUpdatedAt ? new Date(startlistUpdatedAt) : undefined;
    this.startlistPublicVersion = startlistPublicVersion;
  }

  public static create(props: RaceProps): Race {
    const name = props.name?.trim();
    if (!name) {
      throw new Error('Race name must not be empty.');
    }

    return new Race(
      props.id,
      name,
      props.schedule,
      Boolean(props.isDuplicateDay),
      Boolean(props.overlapsExisting),
      props.startlistLink,
      props.startlistUpdatedAt,
      props.startlistPublicVersion
    );
  }

  public getId(): RaceId {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getSchedule(): RaceSchedule {
    return this.schedule;
  }

  public hasDuplicateDay(): boolean {
    return this.isDuplicateDay;
  }

  public hasScheduleOverlap(): boolean {
    return this.overlapsExisting;
  }

  public getStartlistLink(): StartlistLink | undefined {
    return this.startlistLink;
  }

  public getStartlistUpdatedAt(): Date | undefined {
    return this.startlistUpdatedAt ? new Date(this.startlistUpdatedAt) : undefined;
  }

  public getStartlistPublicVersion(): number | undefined {
    return this.startlistPublicVersion;
  }

  public hasPublishedStartlist(): boolean {
    return Boolean(this.startlistLink);
  }

  public attachStartlist(
    link: StartlistLink,
    options: { updatedAt?: Date; publicVersion?: number } = {}
  ): void {
    this.startlistLink = link;
    this.startlistUpdatedAt = options.updatedAt ? new Date(options.updatedAt) : undefined;
    this.startlistPublicVersion = options.publicVersion;
  }
}
