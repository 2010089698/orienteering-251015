import { DomainEvent } from '@startlist-management/domain';

export interface ApplicationEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}
