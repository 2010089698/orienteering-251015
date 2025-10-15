import { describe, expect, it, vi } from 'vitest';
import { Startlist } from '../../../../../Domain/src/startlist/Startlist.js';
import { StartlistId } from '../../../../../Domain/src/startlist/StartlistId.js';
import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository.js';
import { StartlistNotFoundError } from '../errors.js';
import { StartlistQueryServiceImpl } from '../queries/StartlistQueryService.js';

describe('StartlistQueryService', () => {
  it('returns snapshot when startlist exists', async () => {
    const snapshot = { id: 'startlist-1' } as any;
    const startlist = {
      toSnapshot: vi.fn(() => snapshot),
    } as unknown as Startlist;
    const repository: StartlistRepository = {
      findById: vi.fn(async (id) => {
        expect(id).toEqual(StartlistId.create('startlist-1'));
        return startlist;
      }),
      save: vi.fn(),
    };

    const service = new StartlistQueryServiceImpl(repository);
    const result = await service.execute({ startlistId: 'startlist-1' });

    expect(result).toBe(snapshot);
  });

  it('throws when startlist is missing', async () => {
    const repository: StartlistRepository = {
      findById: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(),
    };
    const service = new StartlistQueryServiceImpl(repository);

    await expect(service.execute({ startlistId: 'missing' })).rejects.toBeInstanceOf(StartlistNotFoundError);
  });
});
