import {
  StartlistFactory,
  StartlistId,
  StartlistRepository,
  StartlistSnapshot,
} from '@startlist-management/domain';
import { TransactionManager } from '../../shared/transaction.js';
import {
  InvalidCommandError,
  PersistenceError,
  StartlistApplicationError,
  mapToApplicationError,
} from '../errors.js';

export interface CreateStartlistForRaceCommand {
  startlistId: string;
  eventId: string;
  raceId: string;
  schedule?: {
    start: Date;
    end?: Date;
  };
  updatedAt?: Date;
}

export interface CreateStartlistForRaceResult {
  startlistId: string;
  snapshot: StartlistSnapshot;
  created: boolean;
}

export interface CreateStartlistForRaceUseCase {
  execute(command: CreateStartlistForRaceCommand): Promise<CreateStartlistForRaceResult>;
}

export class CreateStartlistForRaceService implements CreateStartlistForRaceUseCase {
  constructor(
    private readonly repository: StartlistRepository,
    private readonly factory: StartlistFactory,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: CreateStartlistForRaceCommand): Promise<CreateStartlistForRaceResult> {
    try {
      const startlistId = StartlistId.create(command.startlistId);
      const existing = await Promise.resolve(this.repository.findById(startlistId));

      if (existing) {
        return {
          startlistId: startlistId.toString(),
          snapshot: existing.toSnapshot(),
          created: false,
        };
      }

      if (!command.eventId || !command.raceId) {
        throw new InvalidCommandError('eventId and raceId are required to create a startlist.');
      }

      const startlist = this.factory.create(startlistId, {
        eventId: command.eventId,
        raceId: command.raceId,
      });

      const { snapshot } = await this.transactionManager.execute(async () => {
        await Promise.resolve(this.repository.save(startlist)).catch((error) => {
          throw new PersistenceError('Failed to persist startlist changes.', error);
        });
        return { snapshot: startlist.toSnapshot() };
      });

      return {
        startlistId: startlistId.toString(),
        snapshot,
        created: true,
      };
    } catch (error) {
      const appError = error instanceof StartlistApplicationError ? error : mapToApplicationError(error);
      throw appError;
    }
  }
}
