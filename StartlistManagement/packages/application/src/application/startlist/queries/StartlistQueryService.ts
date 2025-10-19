import { StartlistId, StartlistSnapshot } from '@startlist-management/domain';
import { GetStartlistQuery } from '../dto/StartlistDtos.js';
import { StartlistNotFoundError } from '../errors.js';
import { StartlistReadRepository } from './StartlistReadRepository.js';

export interface StartlistQueryService {
  execute(query: GetStartlistQuery): Promise<StartlistSnapshot>;
}

export class StartlistQueryServiceImpl implements StartlistQueryService {
  constructor(private readonly repository: StartlistReadRepository) {}

  async execute(query: GetStartlistQuery): Promise<StartlistSnapshot> {
    const startlistId = StartlistId.create(query.startlistId);
    const startlist = await this.repository.findById(startlistId);
    if (!startlist) {
      throw new StartlistNotFoundError(startlistId.toString());
    }
    return startlist;
  }
}
