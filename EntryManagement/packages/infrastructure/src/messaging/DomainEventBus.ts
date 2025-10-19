import { DomainEvent } from '@entry-management/domain';
import { ApplicationEventPublisher } from '@entry-management/application';

export type DomainEventSubscriber = (event: DomainEvent) => Promise<void> | void;

type ErrorLogger = Pick<Console, 'error'>;

export class DomainEventBus implements ApplicationEventPublisher {
  private readonly subscribers: DomainEventSubscriber[] = [];

  constructor(private readonly logger: ErrorLogger = console) {}

  subscribe(subscriber: DomainEventSubscriber): void {
    this.subscribers.push(subscriber);
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      const results = await Promise.allSettled(
        this.subscribers.map((subscriber) =>
          Promise.resolve().then(() => subscriber(event)),
        ),
      );

      results.forEach((result) => {
        if (result.status === 'rejected') {
          this.logger.error('DomainEventBus subscriber failed', result.reason);
        }
      });
    }
  }
}
