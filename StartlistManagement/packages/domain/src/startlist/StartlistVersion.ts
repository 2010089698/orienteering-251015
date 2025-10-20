import { cloneStartlistSnapshotDto, StartlistSnapshotDto } from './StartlistDtos.js';
import { StartlistSnapshot } from './StartlistSnapshot.js';

export interface StartlistVersion {
  version: number;
  snapshot: StartlistSnapshot;
  confirmedAt: Date;
}

export interface StartlistVersionDto {
  version: number;
  snapshot: StartlistSnapshotDto;
  confirmedAt: string;
}

export const cloneStartlistVersion = (version: StartlistVersion): StartlistVersion => ({
  version: version.version,
  snapshot: cloneStartlistSnapshotDto(version.snapshot),
  confirmedAt: new Date(version.confirmedAt.getTime()),
});

export const toStartlistVersionDto = (version: StartlistVersion): StartlistVersionDto => ({
  version: version.version,
  snapshot: cloneStartlistSnapshotDto(version.snapshot),
  confirmedAt: version.confirmedAt.toISOString(),
});

export const fromStartlistVersionDto = (dto: StartlistVersionDto): StartlistVersion => {
  const confirmedAt = new Date(dto.confirmedAt);
  if (Number.isNaN(confirmedAt.getTime())) {
    throw new Error(`Invalid ISO date value: ${dto.confirmedAt}`);
  }

  return {
    version: dto.version,
    snapshot: cloneStartlistSnapshotDto(dto.snapshot),
    confirmedAt,
  };
};
