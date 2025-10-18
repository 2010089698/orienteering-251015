import { EntryRegisteredEvent } from './events/EntryRegisteredEvent.js';
import { EntryId } from './EntryId.js';
import { EntrySnapshot } from './EntrySnapshot.js';
import type { DomainEvent } from '../common/DomainEvent.js';

export interface EntryProps {
  id: EntryId;
  name: string;
  classId: string;
  cardNumber: string;
  club?: string;
  iofId?: string;
  createdAt: Date;
}

export class Entry {
  private domainEvents: DomainEvent[] = [];

  private constructor(private readonly props: EntryProps) {}

  static register(props: EntryProps): Entry {
    const entry = new Entry(props);
    entry.record(new EntryRegisteredEvent(entry.toSnapshot(), props.createdAt));
    return entry;
  }

  static rehydrate(snapshot: EntrySnapshot): Entry {
    return new Entry({
      id: EntryId.create(snapshot.id),
      name: snapshot.name,
      classId: snapshot.classId,
      cardNumber: snapshot.cardNumber,
      club: snapshot.club,
      iofId: snapshot.iofId,
      createdAt: new Date(snapshot.createdAt),
    });
  }

  private record(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }

  toSnapshot(): EntrySnapshot {
    return {
      id: this.props.id.toString(),
      name: this.props.name,
      classId: this.props.classId,
      cardNumber: this.props.cardNumber,
      club: this.props.club,
      ...(this.props.iofId !== undefined ? { iofId: this.props.iofId } : {}),
      createdAt: this.props.createdAt.toISOString(),
    };
  }

  get id(): EntryId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get classId(): string {
    return this.props.classId;
  }

  get cardNumber(): string {
    return this.props.cardNumber;
  }

  get club(): string | undefined {
    return this.props.club;
  }

  get iofId(): string | undefined {
    return this.props.iofId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
