import { describe, expect, it, vi } from 'vitest';
import {
  StartlistFactory,
  StartlistId,
  StartlistRepository,
  StartlistSnapshot,
  SystemClock,
} from '@startlist-management/domain';
import { TransactionManager } from '../../shared/transaction.js';
import { CreateStartlistForRaceService } from '../commands/CreateStartlistForRaceService.js';

const createTransactionManager = (): TransactionManager => ({
  execute: vi.fn(async (work) => work()),
});

describe('CreateStartlistForRaceService', () => {
  it('creates and persists a new startlist when none exists', async () => {
    const factory = new StartlistFactory(SystemClock);
    const savedSnapshots: StartlistSnapshot[] = [];
    const repository: StartlistRepository = {
      findById: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(async (startlist) => {
        savedSnapshots.push(startlist.toSnapshot());
      }),
    };
    const service = new CreateStartlistForRaceService(repository, factory, createTransactionManager());

    const result = await service.execute({
      startlistId: 'startlist-new',
      eventId: 'event-new',
      raceId: 'race-new',
    });

    expect(result.created).toBe(true);
    expect(result.startlistId).toBe('startlist-new');
    expect(result.snapshot.eventId).toBe('event-new');
    expect(result.snapshot.raceId).toBe('race-new');
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(savedSnapshots).toHaveLength(1);
    expect(savedSnapshots[0]).toMatchObject({ eventId: 'event-new', raceId: 'race-new' });
  });

  it('returns the existing snapshot when startlist already exists', async () => {
    const factory = new StartlistFactory(SystemClock);
    const existing = factory.create(StartlistId.create('startlist-existing'), {
      eventId: 'event-existing',
      raceId: 'race-existing',
    });
    const repository: StartlistRepository = {
      findById: vi.fn().mockResolvedValue(existing),
      save: vi.fn(),
    };
    const service = new CreateStartlistForRaceService(repository, factory, createTransactionManager());

    const result = await service.execute({
      startlistId: 'startlist-existing',
      eventId: 'event-existing',
      raceId: 'race-existing',
    });

    expect(result.created).toBe(false);
    expect(result.snapshot).toEqual(existing.toSnapshot());
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('throws an error when required identifiers are missing', async () => {
    const factory = new StartlistFactory(SystemClock);
    const repository: StartlistRepository = {
      findById: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(),
    };
    const service = new CreateStartlistForRaceService(repository, factory, createTransactionManager());

    await expect(
      service.execute({ startlistId: 'startlist-error', eventId: '', raceId: '' }),
    ).rejects.toThrow('eventId and raceId are required to create a startlist.');
  });
});
