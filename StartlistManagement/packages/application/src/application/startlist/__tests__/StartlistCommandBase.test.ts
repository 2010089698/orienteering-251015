import { describe, expect, it, vi } from 'vitest';
import {
  DomainError,
  DomainEvent,
  Startlist,
  StartlistFactory,
  StartlistId,
  StartlistRepository,
  StartlistSnapshot,
  StartlistStatus,
  StartlistVersionGeneratedEvent,
  StartlistVersionRepository,
} from '@startlist-management/domain';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { InvalidCommandError, PersistenceError, StartlistNotFoundError } from '../errors.js';
import { StartlistCommandBase } from '../commands/StartlistCommandBase.js';

const snapshot: StartlistSnapshot = {
  id: 'startlist-1',
  eventId: 'event-1',
  raceId: 'race-1',
  settings: undefined,
  laneAssignments: [],
  classAssignments: [],
  startTimes: [],
  status: StartlistStatus.DRAFT,
};

class TestCommand extends StartlistCommandBase {
  constructor(
    repository: StartlistRepository,
    versionRepository: StartlistVersionRepository,
    transaction: TransactionManager,
    publisher: ApplicationEventPublisher,
    factory?: StartlistFactory,
  ) {
    super(repository, versionRepository, transaction, publisher, factory);
  }

  async run(
    id: string,
    mutate: (startlist: Startlist) => Promise<void> | void,
    options?: { allowCreate?: boolean },
  ): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(id, mutate, options);
  }
}

describe('StartlistCommandBase', () => {
  const createMocks = ({
    startlist,
    events = [vi.fn() as unknown as DomainEvent],
    factory,
  }: {
    startlist: Startlist | undefined;
    events?: DomainEvent[];
    factory?: StartlistFactory;
  }) => {
    const repository: StartlistRepository = {
      findById: vi.fn().mockResolvedValue(startlist),
      save: vi.fn().mockResolvedValue(void 0),
    };
    const versionRepository: StartlistVersionRepository = {
      saveVersion: vi.fn().mockResolvedValue({
        version: 1,
        snapshot,
        confirmedAt: new Date(),
      }),
      findVersions: vi.fn().mockResolvedValue([]),
    };
    const transaction: TransactionManager = {
      execute: vi.fn(async (work) => work()),
    };
    const publisher: ApplicationEventPublisher = {
      publish: vi.fn().mockResolvedValue(void 0),
    };

    const startlistInstance = startlist ?? ({} as Startlist);
    const startlistWithSpies = startlistInstance as Startlist & {
      toSnapshot: ReturnType<typeof vi.fn>;
      pullDomainEvents: ReturnType<typeof vi.fn>;
    };
    if (startlistWithSpies) {
      startlistWithSpies.toSnapshot = vi.fn().mockReturnValue(snapshot);
      startlistWithSpies.pullDomainEvents = vi.fn().mockReturnValue(events);
    }

    return { repository, versionRepository, transaction, publisher, startlist: startlistWithSpies, factory };
  };

  it('loads existing startlist and publishes events', async () => {
    const existingStartlist = {} as Startlist;
    const { repository, versionRepository, transaction, publisher, startlist } = createMocks({
      startlist: existingStartlist,
    });
    const command = new TestCommand(repository, versionRepository, transaction, publisher);
    const mutate = vi.fn();

    const result = await command.run('startlist-1', mutate);

    expect(repository.findById).toHaveBeenCalledWith(StartlistId.create('startlist-1'));
    expect(mutate).toHaveBeenCalledWith(startlist);
    expect(repository.save).toHaveBeenCalledWith(startlist);
    expect(startlist.pullDomainEvents).toHaveBeenCalled();
    expect(publisher.publish).toHaveBeenCalledWith(expect.any(Array));
    expect(result).toEqual(snapshot);
  });

  it('creates new startlist when allowed and factory provided', async () => {
    const createdStartlist = {
      toSnapshot: vi.fn().mockReturnValue(snapshot),
      pullDomainEvents: vi.fn().mockReturnValue([vi.fn() as unknown as DomainEvent]),
    } as unknown as Startlist;
    const factory = {
      create: vi.fn().mockReturnValue(createdStartlist),
    } as unknown as StartlistFactory;
    const repository: StartlistRepository = {
      findById: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(void 0),
    };
    const versionRepository: StartlistVersionRepository = {
      saveVersion: vi.fn().mockResolvedValue({
        version: 1,
        snapshot,
        confirmedAt: new Date(),
      }),
      findVersions: vi.fn().mockResolvedValue([]),
    };
    const transaction: TransactionManager = {
      execute: vi.fn(async (work) => work()),
    };
    const publisher: ApplicationEventPublisher = {
      publish: vi.fn().mockResolvedValue(void 0),
    };
    const command = new TestCommand(repository, versionRepository, transaction, publisher, factory);
    const mutate = vi.fn();
    const creationContext = { eventId: 'event-create', raceId: 'race-create' };

    const result = await command.run('startlist-1', mutate, {
      allowCreate: true,
      createContext: creationContext,
    });

    expect(factory.create).toHaveBeenCalledWith(StartlistId.create('startlist-1'), creationContext);
    expect(mutate).toHaveBeenCalledWith(createdStartlist);
    expect(repository.save).toHaveBeenCalledWith(createdStartlist);
    expect(createdStartlist.pullDomainEvents).toHaveBeenCalled();
    expect(publisher.publish).toHaveBeenCalled();
    expect(result).toEqual(snapshot);
  });

  it('throws when startlist not found and creation not allowed', async () => {
    const { repository, versionRepository, transaction, publisher } = createMocks({ startlist: undefined });
    const command = new TestCommand(repository, versionRepository, transaction, publisher);

    await expect(command.run('missing', vi.fn())).rejects.toBeInstanceOf(StartlistNotFoundError);
  });

  it('throws when allowCreate is true but factory is missing', async () => {
    const { repository, versionRepository, transaction, publisher } = createMocks({ startlist: undefined });
    const command = new TestCommand(repository, versionRepository, transaction, publisher);

    await expect(
      command.run('missing', vi.fn(), {
        allowCreate: true,
        createContext: { eventId: 'event-missing-factory', raceId: 'race-missing-factory' },
      }),
    ).rejects.toBeInstanceOf(InvalidCommandError);
  });

  it('throws when allowCreate is true but creation context is missing', async () => {
    const factory = {
      create: vi.fn(),
    } as unknown as StartlistFactory;
    const { repository, versionRepository, transaction, publisher } = createMocks({ startlist: undefined });
    const command = new TestCommand(repository, versionRepository, transaction, publisher, factory);

    await expect(
      command.run('missing', vi.fn(), {
        allowCreate: true,
      }),
    ).rejects.toBeInstanceOf(InvalidCommandError);
  });

  it('wraps repository save errors into PersistenceError', async () => {
    const existingStartlist = {} as Startlist;
    const { repository, versionRepository, transaction, publisher } = createMocks({
      startlist: existingStartlist,
    });
    repository.save = vi.fn().mockRejectedValue(new Error('boom'));
    const command = new TestCommand(repository, versionRepository, transaction, publisher);

    await expect(command.run('startlist-1', vi.fn())).rejects.toBeInstanceOf(PersistenceError);
  });

  it('maps domain errors from mutate to InvalidCommandError', async () => {
    const existingStartlist = {} as Startlist;
    const { repository, versionRepository, transaction, publisher } = createMocks({
      startlist: existingStartlist,
    });
    const command = new TestCommand(repository, versionRepository, transaction, publisher);
    const mutate = vi.fn(() => {
      throw new DomainError('invalid');
    });

    await expect(command.run('startlist-1', mutate)).rejects.toBeInstanceOf(InvalidCommandError);
  });

  it('re-throws existing application errors without remapping', async () => {
    const existingStartlist = {} as Startlist;
    const { repository, versionRepository, transaction, publisher } = createMocks({
      startlist: existingStartlist,
    });
    const command = new TestCommand(repository, versionRepository, transaction, publisher);
    const appError = new InvalidCommandError('app-error');
    const mutate = vi.fn(() => {
      throw appError;
    });

    await expect(command.run('startlist-1', mutate)).rejects.toBe(appError);
  });

  it('persists startlist versions when version events are emitted', async () => {
    const existingStartlist = {} as Startlist;
    const confirmedAt = new Date('2024-03-03T00:00:00Z');
    const versionEvent = new StartlistVersionGeneratedEvent('startlist-1', snapshot, confirmedAt);
    const { repository, versionRepository, transaction, publisher } = createMocks({
      startlist: existingStartlist,
      events: [versionEvent],
    });
    const command = new TestCommand(repository, versionRepository, transaction, publisher);

    await command.run('startlist-1', vi.fn());

    expect(versionRepository.saveVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot,
        confirmedAt,
      }),
    );
  });

  it('does not publish when no events are recorded', async () => {
    const existingStartlist = {} as Startlist;
    const { repository, versionRepository, transaction, publisher, startlist } = createMocks({
      startlist: existingStartlist,
      events: [],
    });
    const command = new TestCommand(repository, versionRepository, transaction, publisher);

    await command.run('startlist-1', vi.fn());

    expect(startlist.pullDomainEvents).toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
