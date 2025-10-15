import { DomainEvent } from './DomainEvent';

export interface DomainEventPublisher {
  publish(events: DomainEvent[]): Promise<void> | void;
}
