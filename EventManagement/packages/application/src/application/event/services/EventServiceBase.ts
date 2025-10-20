import { type DomainEvent, type Event, EventId } from '@event-management/domain';

import { EventNotFoundError, PersistenceError } from '../../shared/errors.js';
import { type ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { type TransactionManager } from '../../shared/transaction.js';

export interface EventRepository {
  findById(id: EventId): Promise<Event | undefined>;
  save(event: Event): Promise<void>;
  findAll?(): Promise<readonly Event[]>;
}

export interface EventServiceDependencies {
  repository: EventRepository;
  transactionManager: TransactionManager;
  eventPublisher: ApplicationEventPublisher;
}

export abstract class EventServiceBase {
  protected constructor(
    protected readonly repository: EventRepository,
    private readonly transactionManager: TransactionManager,
    private readonly eventPublisher: ApplicationEventPublisher,
  ) {}

  protected async createEvent(factory: () => Event): Promise<Event> {
    const { event, events } = await this.transactionManager.execute(async () => {
      const event = factory();
      return this.persist(event);
    });

    await this.publish(events);
    return event;
  }

  protected async withEvent(
    eventIdRaw: string,
    mutate: (event: Event) => Promise<void> | void,
  ): Promise<Event> {
    const eventId = EventId.from(eventIdRaw);
    const event = await this.repository.findById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId.toString());
    }

    const { event: updatedEvent, events } = await this.transactionManager.execute(async () => {
      await mutate(event);
      return this.persist(event);
    });

    await this.publish(events);
    return updatedEvent;
  }

  private async persist(event: Event): Promise<{ event: Event; events: DomainEvent[] }> {
    try {
      await Promise.resolve(this.repository.save(event));
    } catch (error) {
      throw new PersistenceError('Failed to persist event.', error);
    }

    const events = event.pullDomainEvents();
    return { event, events };
  }

  private async publish(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.eventPublisher.publish(events);
  }
}
