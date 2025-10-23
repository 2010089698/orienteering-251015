export interface StartlistReferenceProps {
  startlistId: string;
  status: string;
}

export class StartlistReference {
  private readonly startlistId: string;

  private readonly status: string;

  private constructor(props: StartlistReferenceProps) {
    this.startlistId = props.startlistId;
    this.status = props.status;
  }

  public static create(props: StartlistReferenceProps): StartlistReference {
    const startlistId = props.startlistId?.trim();
    if (!startlistId) {
      throw new Error('Startlist ID must not be empty.');
    }

    const status = props.status?.trim();
    if (!status) {
      throw new Error('Startlist status must not be empty.');
    }

    return new StartlistReference({ startlistId, status });
  }

  public getId(): string {
    return this.startlistId;
  }

  public getStatus(): string {
    return this.status;
  }
}
