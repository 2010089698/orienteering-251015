import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot';
import { StartlistId } from '../../../../../Domain/src/startlist/StartlistId';
import { GetStartlistQuery } from '../dto/StartlistDtos';
import { StartlistNotFoundError } from '../errors';

export interface StartlistQueryService {
  execute(query: GetStartlistQuery): Promise<StartlistSnapshot>;
}

export class StartlistQueryServiceImpl implements StartlistQueryService {
  constructor(private readonly repository: StartlistRepository) {}

  async execute(query: GetStartlistQuery): Promise<StartlistSnapshot> {
    const startlistId = StartlistId.create(query.startlistId);
    const startlist = await Promise.resolve(this.repository.findById(startlistId));
    if (!startlist) {
      throw new StartlistNotFoundError(startlistId.toString());
    }
    return startlist.toSnapshot();
  }
}
