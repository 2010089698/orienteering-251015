import { RaceId } from './valueObjects/RaceId.js';
import { RaceSchedule } from './valueObjects/RaceSchedule.js';
import { StartlistAttachment } from './valueObjects/StartlistAttachment.js';

export interface RaceProps {
  id: RaceId;
  name: string;
  schedule: RaceSchedule;
  isDuplicateDay?: boolean;
  overlapsExisting?: boolean;
  startlistAttachment?: StartlistAttachment;
}

export class Race {
  private startlistAttachment?: StartlistAttachment;

  private constructor(
    private readonly id: RaceId,
    private readonly name: string,
    private readonly schedule: RaceSchedule,
    private readonly isDuplicateDay: boolean,
    private readonly overlapsExisting: boolean,
    startlistAttachment?: StartlistAttachment,
  ) {
    this.startlistAttachment = startlistAttachment;
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
      props.startlistAttachment,
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

  public getStartlistAttachment(): StartlistAttachment | undefined {
    return this.startlistAttachment;
  }

  public getStartlistId(): string | undefined {
    return this.startlistAttachment?.getId();
  }

  public getStartlistPublicUrl(): string | undefined {
    return this.startlistAttachment?.getPublicUrl();
  }

  public getStartlistUpdatedAt(): Date | undefined {
    return this.startlistAttachment?.getUpdatedAt();
  }

  public getStartlistPublicVersion(): number | undefined {
    return this.startlistAttachment?.getPublicVersion();
  }

  public hasPublishedStartlist(): boolean {
    return Boolean(this.startlistAttachment);
  }

  public attachStartlist(attachment: StartlistAttachment): void {
    this.startlistAttachment = attachment;
  }
}
