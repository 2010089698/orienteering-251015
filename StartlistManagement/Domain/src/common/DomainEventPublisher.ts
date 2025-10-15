import { DomainEvent } from './DomainEvent.js';

export interface DomainEventPublisher {
  publish(events: DomainEvent[]): Promise<void> | void;
}
