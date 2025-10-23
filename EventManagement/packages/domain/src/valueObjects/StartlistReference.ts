export interface StartlistReferenceProps {
  startlistId: string;
  status: string;
  confirmedAt?: Date;
  publicVersion?: number;
  publicUrl?: string;
}

export class StartlistReference {
  private readonly startlistId: string;

  private readonly status: string;

  private readonly confirmedAt?: Date;

  private readonly publicVersion?: number;

  private readonly publicUrl?: string;

  private constructor(props: StartlistReferenceProps) {
    this.startlistId = props.startlistId;
    this.status = props.status;
    this.confirmedAt = props.confirmedAt;
    this.publicVersion = props.publicVersion;
    this.publicUrl = props.publicUrl;
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

    let confirmedAt: Date | undefined;
    if (props.confirmedAt !== undefined) {
      if (!(props.confirmedAt instanceof Date) || Number.isNaN(props.confirmedAt.valueOf())) {
        throw new Error('Startlist confirmation time must be a valid Date instance.');
      }
      confirmedAt = props.confirmedAt;
    }

    let publicVersion: number | undefined;
    if (props.publicVersion !== undefined) {
      if (!Number.isInteger(props.publicVersion) || props.publicVersion < 1) {
        throw new Error('Startlist public version must be a positive integer.');
      }
      publicVersion = props.publicVersion;
    }

    let publicUrl: string | undefined;
    if (props.publicUrl !== undefined) {
      const trimmedUrl = props.publicUrl.trim();
      if (!trimmedUrl) {
        throw new Error('Startlist public URL must not be empty.');
      }
      try {
        new URL(trimmedUrl);
      } catch {
        throw new Error('Startlist public URL must be a valid absolute URL.');
      }
      publicUrl = trimmedUrl;
    }

    return new StartlistReference({
      startlistId,
      status,
      confirmedAt,
      publicVersion,
      publicUrl,
    });
  }

  public getId(): string {
    return this.startlistId;
  }

  public getStatus(): string {
    return this.status;
  }

  public getConfirmedAt(): Date | undefined {
    return this.confirmedAt;
  }

  public getPublicVersion(): number | undefined {
    return this.publicVersion;
  }

  public getPublicUrl(): string | undefined {
    return this.publicUrl;
  }
}
