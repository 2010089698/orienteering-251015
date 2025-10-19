import { describe, expect, it, vi } from 'vitest';
import {
  Entry,
  EntryFactory,
  type EntryRepository,
  type DomainClock,
  DomainError,
} from '@entry-management/domain';
import {
  type ApplicationEventPublisher,
  type TransactionManager,
} from '../../../shared/index.js';
import { RegisterEntryService } from '../RegisterEntryUseCase.js';

class StubEntryRepository implements EntryRepository {
  savedEntries: Entry[] = [];

  constructor(
    private readonly overrides: {
      save?: (entry: Entry) => Promise<void>;
    } = {},
  ) {}

  async save(entry: Entry): Promise<void> {
    if (this.overrides.save) {
      return this.overrides.save(entry);
    }
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

const createUseCase = (
  clock: DomainClock,
  options: {
    repository?: StubEntryRepository;
    eventPublisher?: ApplicationEventPublisher;
  } = {},
) => {
  const repository = options.repository ?? new StubEntryRepository();
  const factory = new EntryFactory(clock);
  const transactionManager: TransactionManager = {
    execute: (work) => Promise.resolve(work()),
  };
  const eventPublisher: ApplicationEventPublisher =
    options.eventPublisher ?? ({ publish: vi.fn(async () => {}) } as ApplicationEventPublisher);

  return {
    repository,
    service: new RegisterEntryService(
      repository,
      factory,
      transactionManager,
      eventPublisher,
    ),
    eventPublisher,
  };
};

describe('RegisterEntryService', () => {
  const clock: DomainClock = {
    now: () => new Date('2024-02-01T10:00:00Z'),
  };

  it('returns the IOF ID when registering an entry that provides one', async () => {
    const { service, repository, eventPublisher } = createUseCase(clock);

    const result = await service.execute({
      name: 'Alice Runner',
      classId: 'W21',
      cardNumber: '123456',
      club: 'Forest Club',
      iofId: 'IOF-123',
    });

    expect(result.iofId).toBe('IOF-123');
    expect(repository.savedEntries[0]?.iofId).toBe('IOF-123');
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.any(Array));
  });

  it('omits the IOF ID when it is not provided', async () => {
    const { service, repository, eventPublisher } = createUseCase(clock);

    const result = await service.execute({
      name: 'Bob Runner',
      classId: 'M21',
      cardNumber: '654321',
    });

    expect(result.iofId).toBeUndefined();
    expect(repository.savedEntries[0]?.iofId).toBeUndefined();
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.any(Array));
  });

  it('throws a DomainError when validation fails', async () => {
    const { service, repository, eventPublisher } = createUseCase(clock);

    await expect(
      service.execute({
        name: '   ',
        classId: 'M21',
        cardNumber: '654321',
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(repository.savedEntries).toHaveLength(0);
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('does not publish events when saving the entry fails', async () => {
    const repository = new StubEntryRepository({
      save: vi.fn().mockRejectedValue(new Error('failed to persist')),
    });
    const eventPublisher: ApplicationEventPublisher = {
      publish: vi.fn(async () => {}),
    };
    const { service } = createUseCase(clock, { repository, eventPublisher });

    await expect(
      service.execute({
        name: 'Charlie Runner',
        classId: 'M35',
        cardNumber: '777777',
      }),
    ).rejects.toThrow('failed to persist');

    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });
});
