import { StartlistRepository, StartlistSnapshot, StartlistId } from '@startlist-management/domain';
import { GetStartlistQuery } from '../dto/StartlistDtos.js';
import { StartlistNotFoundError } from '../errors.js';

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
