import { DomainEvent } from '../../../../Domain/src/common/DomainEvent';

export interface ApplicationEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}
