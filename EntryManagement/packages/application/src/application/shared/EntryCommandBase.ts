import { Entry, EntryRepository, DomainEvent } from '@entry-management/domain';
import { ApplicationEventPublisher } from './event-publisher.js';
import { TransactionManager } from './transaction.js';

export interface EntryCommandResult<TResult> {
  entry: Entry;
  result: TResult;
}

export abstract class EntryCommandBase {
  protected constructor(
    private readonly repository: EntryRepository,
    private readonly transactionManager: TransactionManager,
    private readonly eventPublisher: ApplicationEventPublisher,
  ) {}

  protected async execute<TResult>(
    work: () => Promise<EntryCommandResult<TResult>> | EntryCommandResult<TResult>,
  ): Promise<TResult> {
    const { result, events } = await this.transactionManager.execute(async () => {
      const { entry, result } = await work();
      await Promise.resolve(this.repository.save(entry));
      const events = entry.pullDomainEvents();
      return { result, events };
    });

    await this.publish(events);
    return result;
  }

  private async publish(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.eventPublisher.publish(events);
  }
}
