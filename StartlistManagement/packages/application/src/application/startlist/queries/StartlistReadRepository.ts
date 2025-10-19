import { StartlistId, StartlistSnapshot } from '@startlist-management/domain';

export interface StartlistReadRepository {
  findById(id: StartlistId): Promise<StartlistSnapshot | undefined>;
}
