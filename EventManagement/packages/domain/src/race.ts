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
}

export class Race {
  private startlistLink?: StartlistLink;

  private constructor(
    private readonly id: RaceId,
    private readonly name: string,
    private readonly schedule: RaceSchedule,
    private readonly isDuplicateDay: boolean,
    private readonly overlapsExisting: boolean,
    startlistLink?: StartlistLink
  ) {
    this.startlistLink = startlistLink;
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
      props.startlistLink
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

  public attachStartlist(link: StartlistLink): void {
    this.startlistLink = link;
  }
}
