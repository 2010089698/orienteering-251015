import { DomainEvent } from '../../../../../Domain/src/common/DomainEvent.js';
import { Startlist } from '../../../../../Domain/src/startlist/Startlist.js';
import { StartlistFactory } from '../../../../../Domain/src/startlist/StartlistFactory.js';
import { StartlistId } from '../../../../../Domain/src/startlist/StartlistId.js';
import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository.js';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot.js';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import {
  InvalidCommandError,
  PersistenceError,
  StartlistApplicationError,
  StartlistNotFoundError,
  mapToApplicationError,
} from '../errors.js';

export abstract class StartlistCommandBase {
  protected constructor(
    private readonly repository: StartlistRepository,
    private readonly transactionManager: TransactionManager,
    private readonly eventPublisher: ApplicationEventPublisher,
    private readonly factory?: StartlistFactory,
  ) {}

  protected async executeOnStartlist(
    startlistIdRaw: string,
    mutate: (startlist: Startlist) => Promise<void> | void,
    options: { allowCreate?: boolean } = {},
  ): Promise<StartlistSnapshot> {
    try {
      const startlistId = StartlistId.create(startlistIdRaw);
      let startlist = await Promise.resolve(this.repository.findById(startlistId));

      if (!startlist) {
        if (!options.allowCreate) {
          throw new StartlistNotFoundError(startlistId.toString());
        }
        if (!this.factory) {
          throw new InvalidCommandError('Startlist factory is required to create a new startlist.');
        }
        startlist = this.factory.create(startlistId);
      }

      const { snapshot, events } = await this.transactionManager.execute(async () => {
        await mutate(startlist!);
        await Promise.resolve(this.repository.save(startlist!)).catch((error) => {
          throw new PersistenceError('Failed to persist startlist changes.', error);
        });
        const events = startlist!.pullDomainEvents();
        return {
          snapshot: startlist!.toSnapshot(),
          events,
        };
      });

      await this.publish(events);
      return snapshot;
    } catch (error) {
      const appError = error instanceof StartlistApplicationError ? error : mapToApplicationError(error);
      throw appError;
    }
  }

  private async publish(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.eventPublisher.publish(events);
  }
}
