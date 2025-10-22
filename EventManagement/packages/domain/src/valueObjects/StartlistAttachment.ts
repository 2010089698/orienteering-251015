export interface StartlistAttachmentProps {
  startlistId: string;
  publicUrl?: string;
  updatedAt?: Date;
  publicVersion?: number;
}

export class StartlistAttachment {
  private readonly startlistId: string;

  private readonly publicUrl?: string;

  private readonly updatedAt?: Date;

  private readonly publicVersion?: number;

  private constructor(props: StartlistAttachmentProps) {
    this.startlistId = props.startlistId;
    this.publicUrl = props.publicUrl;
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : undefined;
    this.publicVersion = props.publicVersion;
  }

  public static create(props: StartlistAttachmentProps): StartlistAttachment {
    const startlistId = props.startlistId?.trim();
    if (!startlistId) {
      throw new Error('Startlist ID must not be empty.');
    }

    let publicUrl: string | undefined;
    if (props.publicUrl !== undefined) {
      const trimmed = props.publicUrl.trim();
      if (!trimmed) {
        throw new Error('Startlist public URL, if provided, must not be empty.');
      }
      try {
        // eslint-disable-next-line no-new
        new URL(trimmed);
      } catch {
        throw new Error('Startlist public URL must be a valid URL.');
      }
      publicUrl = trimmed;
    }

    let updatedAt: Date | undefined;
    if (props.updatedAt !== undefined) {
      const date = new Date(props.updatedAt);
      if (Number.isNaN(date.valueOf())) {
        throw new Error('Startlist updated timestamp must be a valid date.');
      }
      updatedAt = date;
    }

    if (
      props.publicVersion !== undefined &&
      (!Number.isInteger(props.publicVersion) || props.publicVersion < 1)
    ) {
      throw new Error('Startlist public version must be a positive integer.');
    }

    return new StartlistAttachment({
      startlistId,
      publicUrl,
      updatedAt,
      publicVersion: props.publicVersion,
    });
  }

  public getId(): string {
    return this.startlistId;
  }

  public getPublicUrl(): string | undefined {
    return this.publicUrl;
  }

  public getUpdatedAt(): Date | undefined {
    return this.updatedAt ? new Date(this.updatedAt) : undefined;
  }

  public getPublicVersion(): number | undefined {
    return this.publicVersion;
  }
}
