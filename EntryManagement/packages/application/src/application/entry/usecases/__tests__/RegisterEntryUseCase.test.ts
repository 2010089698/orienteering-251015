import { describe, expect, it, vi } from 'vitest';
import {
  Entry,
  EntryFactory,
  type EntryRepository,
  type DomainClock,
} from '@entry-management/domain';
import {
  type ApplicationEventPublisher,
  type TransactionManager,
} from '../../../shared/index.js';
import { RegisterEntryService } from '../RegisterEntryUseCase.js';

class StubEntryRepository implements EntryRepository {
  savedEntries: Entry[] = [];

  async save(entry: Entry): Promise<void> {
    this.savedEntries.push(entry);
  }

  async findById(): Promise<Entry | null> {
    return null;
  }

  async findAll(): Promise<Entry[]> {
    return [];
  }

  async delete(): Promise<void> {}
}

const createUseCase = (clock: DomainClock) => {
  const repository = new StubEntryRepository();
  const factory = new EntryFactory(clock);
  const transactionManager: TransactionManager = {
    execute: (work) => Promise.resolve(work()),
  };
  const eventPublisher: ApplicationEventPublisher = {
    publish: vi.fn(async () => {}),
  };

  return {
    repository,
    service: new RegisterEntryService(
      repository,
      factory,
      transactionManager,
      eventPublisher,
    ),
  };
};

describe('RegisterEntryService', () => {
  const clock: DomainClock = {
    now: () => new Date('2024-02-01T10:00:00Z'),
  };

  it('returns the IOF ID when registering an entry that provides one', async () => {
    const { service, repository } = createUseCase(clock);

    const result = await service.execute({
      name: 'Alice Runner',
      classId: 'W21',
      cardNumber: '123456',
      club: 'Forest Club',
      iofId: 'IOF-123',
    });

    expect(result.iofId).toBe('IOF-123');
    expect(repository.savedEntries[0]?.iofId).toBe('IOF-123');
  });

  it('omits the IOF ID when it is not provided', async () => {
    const { service, repository } = createUseCase(clock);

    const result = await service.execute({
      name: 'Bob Runner',
      classId: 'M21',
      cardNumber: '654321',
    });

    expect(result.iofId).toBeUndefined();
    expect(repository.savedEntries[0]?.iofId).toBeUndefined();
  });
});
