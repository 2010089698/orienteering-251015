import { type DomainEvent } from '@event-management/domain';

export interface ApplicationEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}
