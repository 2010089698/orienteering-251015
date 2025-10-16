import { DomainEvent } from '@entry-management/domain';

export interface ApplicationEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}
