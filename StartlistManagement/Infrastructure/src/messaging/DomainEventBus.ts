import { DomainEvent } from '../../../Domain/src/common/DomainEvent.js';
import { ApplicationEventPublisher } from '../../../Application/src/application/shared/event-publisher.js';

export type DomainEventSubscriber = (event: DomainEvent) => Promise<void> | void;

export class DomainEventBus implements ApplicationEventPublisher {
  private readonly subscribers: DomainEventSubscriber[] = [];

  subscribe(subscriber: DomainEventSubscriber): void {
    this.subscribers.push(subscriber);
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const subscriber of this.subscribers) {
        await subscriber(event);
      }
    }
  }
}
