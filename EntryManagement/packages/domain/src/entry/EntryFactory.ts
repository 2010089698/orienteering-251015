import { DomainClock } from '../common/DomainClock.js';
import { Entry } from './Entry.js';
import { EntryId } from './EntryId.js';

export interface RegisterEntryParams {
  id?: string;
  name: string;
  classId: string;
  cardNumber: string;
  club?: string;
  iofId?: string;
}

export class EntryFactory {
  constructor(private readonly clock: DomainClock) {}

  register(params: RegisterEntryParams): Entry {
    const id = params.id ? EntryId.create(params.id) : EntryId.generate();
    return Entry.register({
      id,
      name: params.name,
      classId: params.classId,
      cardNumber: params.cardNumber,
      club: params.club,
      iofId: params.iofId,
      createdAt: this.clock.now(),
    });
  }
}
