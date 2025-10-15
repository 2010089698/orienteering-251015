import { Startlist } from './Startlist';
import { StartlistId } from './StartlistId';

export interface StartlistRepository {
  findById(id: StartlistId): Promise<Startlist | undefined> | Startlist | undefined;
  save(startlist: Startlist): Promise<void> | void;
}
