export interface DomainEvent {
  readonly occurredAt: Date;
  readonly type: string;
}
