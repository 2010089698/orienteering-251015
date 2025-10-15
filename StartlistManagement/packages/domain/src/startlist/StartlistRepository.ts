import { Startlist } from './Startlist.js';
import { StartlistId } from './StartlistId.js';

export interface StartlistRepository {
  findById(id: StartlistId): Promise<Startlist | undefined> | Startlist | undefined;
  save(startlist: Startlist): Promise<void> | void;
}
