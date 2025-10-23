import { RaceId } from './valueObjects/RaceId.js';
import { RaceSchedule } from './valueObjects/RaceSchedule.js';
import { StartlistReference } from './valueObjects/StartlistReference.js';

export interface RaceProps {
  id: RaceId;
  name: string;
  schedule: RaceSchedule;
  isDuplicateDay?: boolean;
  overlapsExisting?: boolean;
  startlistReference?: StartlistReference;
}

export class Race {
  private startlistReference?: StartlistReference;

  private constructor(
    private readonly id: RaceId,
    private readonly name: string,
    private readonly schedule: RaceSchedule,
    private readonly isDuplicateDay: boolean,
    private readonly overlapsExisting: boolean,
    startlistReference?: StartlistReference,
  ) {
    this.startlistReference = startlistReference;
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
      props.startlistReference,
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

  public getStartlistReference(): StartlistReference | undefined {
    return this.startlistReference;
  }

  public getStartlistId(): string | undefined {
    return this.startlistReference?.getId();
  }

  public getStartlistStatus(): string | undefined {
    return this.startlistReference?.getStatus();
  }

  public getStartlistConfirmedAt(): Date | undefined {
    return this.startlistReference?.getConfirmedAt();
  }

  public getStartlistPublicVersion(): number | undefined {
    return this.startlistReference?.getPublicVersion();
  }

  public getStartlistPublicUrl(): string | undefined {
    return this.startlistReference?.getPublicUrl();
  }

  public hasStartlistReference(): boolean {
    return Boolean(this.startlistReference);
  }

  public attachStartlistReference(reference: StartlistReference): void {
    this.startlistReference = reference;
  }
}
