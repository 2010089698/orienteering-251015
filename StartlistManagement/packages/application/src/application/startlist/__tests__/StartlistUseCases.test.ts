import { describe, expect, it, vi } from 'vitest';
import { Startlist, StartlistRepository } from '@startlist-management/domain';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { AssignLaneOrderService } from '../commands/AssignLaneOrderUseCase.js';
import { AssignPlayerOrderService } from '../commands/AssignPlayerOrderUseCase.js';
import { AssignStartTimesService } from '../commands/AssignStartTimesUseCase.js';
import { EnterStartlistSettingsService } from '../commands/EnterStartlistSettingsUseCase.js';
import { FinalizeStartlistService } from '../commands/FinalizeStartlistUseCase.js';
import { InvalidateStartTimesService } from '../commands/InvalidateStartTimesUseCase.js';
import { ManuallyFinalizeClassStartOrderService } from '../commands/ManuallyFinalizeClassStartOrderUseCase.js';
import { ManuallyReassignLaneOrderService } from '../commands/ManuallyReassignLaneOrderUseCase.js';
import { StartlistFactory } from '@startlist-management/domain';
import { InvalidCommandError } from '../errors.js';

const createBaseDeps = (startlist: Partial<Startlist>) => {
  const startlistStub = {
    ...startlist,
    toSnapshot: vi.fn(() => ({
      id: 'startlist-1',
      settings: undefined,
      laneAssignments: [],
      classAssignments: [],
      startTimes: [],
      status: 'DRAFT' as const,
    })),
    pullDomainEvents: vi.fn(() => []),
  } as unknown as Startlist;

  const repository: StartlistRepository = {
    findById: vi.fn().mockResolvedValue(startlistStub),
    save: vi.fn().mockResolvedValue(void 0),
  };
  const transactionManager: TransactionManager = {
    execute: vi.fn(async (work) => work()),
  };
  const publisher: ApplicationEventPublisher = {
    publish: vi.fn().mockResolvedValue(void 0),
  };

  return { repository, transactionManager, publisher, startlist: startlistStub };
};

describe('Startlist application use cases', () => {
  it('EnterStartlistSettingsService maps DTO and allows creation', async () => {
    const createdStartlist = {
      enterSettings: vi.fn(),
      toSnapshot: vi.fn(() => ({
        id: 'startlist-1',
        settings: undefined,
        laneAssignments: [],
        classAssignments: [],
        startTimes: [],
        status: 'DRAFT' as const,
      })),
      pullDomainEvents: vi.fn(() => []),
    } as unknown as Startlist;

    const factory = {
      create: vi.fn(() => createdStartlist),
    } as unknown as StartlistFactory;

    const repository: StartlistRepository = {
      findById: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(void 0),
    };
    const transactionManager: TransactionManager = {
      execute: vi.fn(async (work) => work()),
    };
    const publisher: ApplicationEventPublisher = {
      publish: vi.fn().mockResolvedValue(void 0),
    };

    const service = new EnterStartlistSettingsService(repository, transactionManager, publisher, factory);

    await service.execute({
      startlistId: 'startlist-1',
      settings: {
        eventId: 'event-1',
        startTime: new Date().toISOString(),
        interval: { milliseconds: 60000 },
        laneCount: 4,
        intervalType: 'player',
      },
    });

    const enterSettingsMock = (createdStartlist as unknown as {
      enterSettings: ReturnType<typeof vi.fn>;
    }).enterSettings;
    expect(enterSettingsMock).toHaveBeenCalledWith(expect.objectContaining({ laneCount: 4 }));
  });

  it('AssignLaneOrderService validates settings presence', async () => {
    const { repository, transactionManager, publisher } = createBaseDeps({
      getSettings: vi.fn(() => undefined),
    });
    const service = new AssignLaneOrderService(repository, transactionManager, publisher);

    await expect(
      service.execute({
        startlistId: 'startlist-1',
        assignments: [],
      }),
    ).rejects.toBeInstanceOf(InvalidCommandError);
  });

  it('AssignLaneOrderService maps lane assignments with lane count', async () => {
    const assignLaneOrder = vi.fn();
    const { repository, transactionManager, publisher } = createBaseDeps({
      getSettings: vi.fn(() => ({ laneCount: 3, intervalType: 'player' })),
      assignLaneOrderAndIntervals: assignLaneOrder,
    });
    const service = new AssignLaneOrderService(repository, transactionManager, publisher);

    await service.execute({
      startlistId: 'startlist-1',
      assignments: [
        { laneNumber: 1, classOrder: ['class-1'], interval: { milliseconds: 120000 } },
      ],
    });

    expect(assignLaneOrder).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ laneNumber: 1, classOrder: ['class-1'] })]),
    );
  });

  it('ManuallyReassignLaneOrderService validates settings presence', async () => {
    const { repository, transactionManager, publisher } = createBaseDeps({
      getSettings: vi.fn(() => undefined),
    });
    const service = new ManuallyReassignLaneOrderService(repository, transactionManager, publisher);

    await expect(
      service.execute({
        startlistId: 'startlist-1',
        assignments: [],
        reason: 'manual',
      }),
    ).rejects.toBeInstanceOf(InvalidCommandError);
  });

  it('ManuallyReassignLaneOrderService maps assignments and reason', async () => {
    const manual = vi.fn();
    const { repository, transactionManager, publisher } = createBaseDeps({
      getSettings: vi.fn(() => ({ laneCount: 2, intervalType: 'player' })),
      manuallyReassignLaneOrder: manual,
    });
    const service = new ManuallyReassignLaneOrderService(repository, transactionManager, publisher);

    await service.execute({
      startlistId: 'startlist-1',
      assignments: [
        { laneNumber: 1, classOrder: ['class-1'], interval: { milliseconds: 60000 } },
      ],
      reason: 'manual',
    });

    expect(manual).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ laneNumber: 1 })]),
      'manual',
    );
  });

  it('AssignPlayerOrderService maps class assignments', async () => {
    const assignPlayer = vi.fn();
    const { repository, transactionManager, publisher } = createBaseDeps({
      assignPlayerOrderAndIntervals: assignPlayer,
    });
    const service = new AssignPlayerOrderService(repository, transactionManager, publisher);

    await service.execute({
      startlistId: 'startlist-1',
      assignments: [
        { classId: 'class-1', playerOrder: ['player-1'], interval: { milliseconds: 30000 } },
      ],
    });

    expect(assignPlayer).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ classId: 'class-1', playerOrder: ['player-1'] })]),
    );
  });

  it('ManuallyFinalizeClassStartOrderService maps assignments and reason', async () => {
    const manualFinalize = vi.fn();
    const { repository, transactionManager, publisher } = createBaseDeps({
      manuallyFinalizeClassStartOrder: manualFinalize,
    });
    const service = new ManuallyFinalizeClassStartOrderService(repository, transactionManager, publisher);

    await service.execute({
      startlistId: 'startlist-1',
      assignments: [
        { classId: 'class-1', playerOrder: ['player-1'], interval: { milliseconds: 45000 } },
      ],
      reason: 'manual finalize',
    });

    expect(manualFinalize).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ classId: 'class-1' })]),
      'manual finalize',
    );
  });

  it('AssignStartTimesService maps start times DTO', async () => {
    const assignStartTimes = vi.fn();
    const { repository, transactionManager, publisher } = createBaseDeps({
      assignStartTimes,
    });
    const service = new AssignStartTimesService(repository, transactionManager, publisher);

    const startTime = new Date().toISOString();
    await service.execute({
      startlistId: 'startlist-1',
      startTimes: [{ playerId: 'player-1', startTime, laneNumber: 1 }],
    });

    expect(assignStartTimes).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ playerId: 'player-1', laneNumber: 1 })]),
    );
  });

  it('FinalizeStartlistService invokes finalize on startlist', async () => {
    const finalize = vi.fn();
    const { repository, transactionManager, publisher } = createBaseDeps({
      finalizeStartlist: finalize,
    });
    const service = new FinalizeStartlistService(repository, transactionManager, publisher);

    await service.execute({ startlistId: 'startlist-1' });

    expect(finalize).toHaveBeenCalled();
  });

  it('InvalidateStartTimesService passes reason', async () => {
    const invalidate = vi.fn();
    const { repository, transactionManager, publisher } = createBaseDeps({
      invalidateStartTimes: invalidate,
    });
    const service = new InvalidateStartTimesService(repository, transactionManager, publisher);

    await service.execute({ startlistId: 'startlist-1', reason: 'manual' });

    expect(invalidate).toHaveBeenCalledWith('manual');
  });
});
