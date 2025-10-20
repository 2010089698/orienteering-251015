import { StartlistId } from './StartlistId.js';
import { StartlistSnapshot } from './StartlistSnapshot.js';
import { StartlistVersion } from './StartlistVersion.js';

export interface SaveStartlistVersionParams {
  startlistId: StartlistId;
  snapshot: StartlistSnapshot;
  confirmedAt: Date;
}

export interface StartlistVersionRepository {
  saveVersion(params: SaveStartlistVersionParams): Promise<StartlistVersion> | StartlistVersion;
  findVersions(startlistId: StartlistId): Promise<StartlistVersion[]> | StartlistVersion[];
}
