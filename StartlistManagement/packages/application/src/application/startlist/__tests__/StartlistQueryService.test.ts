import { describe, expect, it, vi } from 'vitest';
import { StartlistId, StartlistSnapshot } from '@startlist-management/domain';
import { StartlistNotFoundError } from '../errors.js';
import { StartlistQueryServiceImpl } from '../queries/StartlistQueryService.js';
import { StartlistReadRepository } from '../queries/StartlistReadRepository.js';

describe('StartlistQueryService', () => {
  it('returns snapshot when startlist exists', async () => {
    const snapshot = { id: 'startlist-1' } as StartlistSnapshot;
    const repository: StartlistReadRepository = {
      findById: vi.fn(async (id) => {
        expect(id).toEqual(StartlistId.create('startlist-1'));
        return snapshot;
      }),
    };

    const service = new StartlistQueryServiceImpl(repository);
    const result = await service.execute({ startlistId: 'startlist-1' });

    expect(result).toBe(snapshot);
  });

  it('throws when startlist is missing', async () => {
    const repository: StartlistReadRepository = {
      findById: vi.fn().mockResolvedValue(undefined),
    };
    const service = new StartlistQueryServiceImpl(repository);

    await expect(service.execute({ startlistId: 'missing' })).rejects.toBeInstanceOf(StartlistNotFoundError);
  });
});
