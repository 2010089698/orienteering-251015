import { DomainEvent } from '../../../../Domain/src/common/DomainEvent.js';

export interface ApplicationEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}
