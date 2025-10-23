import { describe, expect, it, vi } from 'vitest';
import {
  Duration,
  Startlist,
  StartlistRepository,
  StartlistSettingsNotEnteredError,
  StartlistStatus,
  StartlistVersionGeneratedEvent,
  StartlistVersionRepository,
  StartlistSnapshot,
} from '@startlist-management/domain';
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

const createBaseDeps = (startlist: Partial<Startlist> = {}) => {
  const defaultStartlist: Partial<Startlist> = {
    getSettings: vi.fn(() => undefined),
    getSettingsOrThrow: vi.fn(() => {
      throw new StartlistSettingsNotEnteredError();
    }),
    toSnapshot: vi.fn(() => ({
      id: 'startlist-1',
      eventId: 'event-1',
      raceId: 'race-1',
      settings: undefined,
      laneAssignments: [],
      classAssignments: [],
      startTimes: [],
      status: StartlistStatus.DRAFT,
    })),
    pullDomainEvents: vi.fn(() => []),
  };

  const startlistStub = {
    ...defaultStartlist,
    ...startlist,
  } as Startlist;

  const repository: StartlistRepository = {
    findById: vi.fn().mockResolvedValue(startlistStub),
    save: vi.fn().mockResolvedValue(void 0),
  };
  const versionRepository: StartlistVersionRepository = {
    saveVersion: vi.fn().mockResolvedValue({
      version: 1,
      snapshot: startlistStub.toSnapshot?.() as StartlistSnapshot,
      confirmedAt: new Date(),
    }),
    findVersions: vi.fn().mockResolvedValue([]),
  };
  const transactionManager: TransactionManager = {
    execute: vi.fn(async (work) => work()),
  };
  const publisher: ApplicationEventPublisher = {
    publish: vi.fn().mockResolvedValue(void 0),
  };

  return { repository, versionRepository, transactionManager, publisher, startlist: startlistStub };
};

describe('Startlist application use cases', () => {
  it('EnterStartlistSettingsService maps DTO and allows creation', async () => {
    const createdStartlist = {
      enterSettings: vi.fn(),
      toSnapshot: vi.fn(() => ({
        id: 'startlist-1',
        eventId: 'event-1',
        raceId: 'race-1',
        settings: undefined,
        laneAssignments: [],
        classAssignments: [],
        startTimes: [],
        status: StartlistStatus.DRAFT,
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
    const versionRepository: StartlistVersionRepository = {
      saveVersion: vi.fn().mockResolvedValue({
        version: 1,
        snapshot: createdStartlist.toSnapshot(),
        confirmedAt: new Date(),
      }),
      findVersions: vi.fn().mockResolvedValue([]),
    };
    const transactionManager: TransactionManager = {
      execute: vi.fn(async (work) => work()),
    };
    const publisher: ApplicationEventPublisher = {
      publish: vi.fn().mockResolvedValue(void 0),
    };

    const service = new EnterStartlistSettingsService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
      factory,
    );

    await service.execute({
      startlistId: 'startlist-1',
      settings: {
        eventId: 'event-1',
        startTime: new Date().toISOString(),
        intervals: {
          laneClass: { milliseconds: 60000 },
          classPlayer: { milliseconds: 45000 },
        },
        laneCount: 4,
      },
    });

    const enterSettingsMock = (createdStartlist as unknown as {
      enterSettings: ReturnType<typeof vi.fn>;
    }).enterSettings;
    expect(enterSettingsMock).toHaveBeenCalledWith(expect.objectContaining({ laneCount: 4 }));
  });

  it('AssignLaneOrderService validates settings presence', async () => {
    const { repository, versionRepository, transactionManager, publisher } = createBaseDeps();
    const service = new AssignLaneOrderService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
    );

    await expect(
      service.execute({
        startlistId: 'startlist-1',
        assignments: [],
      }),
    ).rejects.toBeInstanceOf(InvalidCommandError);
  });

  it('AssignLaneOrderService maps lane assignments with lane count', async () => {
    const assignLaneOrder = vi.fn();
    const settings = {
      laneCount: 3,
      laneClassInterval: Duration.fromMilliseconds(60000),
      classPlayerInterval: Duration.fromMilliseconds(45000),
    };
    const { repository, versionRepository, transactionManager, publisher } = createBaseDeps({
      getSettings: vi.fn(() => settings),
      getSettingsOrThrow: vi.fn(() => settings),
      assignLaneOrderAndIntervals: assignLaneOrder,
    });
    const service = new AssignLaneOrderService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
    );

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
    const { repository, versionRepository, transactionManager, publisher } = createBaseDeps();
    const service = new ManuallyReassignLaneOrderService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
    );

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
    const settings = {
      laneCount: 2,
      laneClassInterval: Duration.fromMilliseconds(60000),
      classPlayerInterval: Duration.fromMilliseconds(45000),
    };
    const { repository, versionRepository, transactionManager, publisher } = createBaseDeps({
      getSettings: vi.fn(() => settings),
      getSettingsOrThrow: vi.fn(() => settings),
      manuallyReassignLaneOrder: manual,
    });
    const service = new ManuallyReassignLaneOrderService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
    );

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
    const { repository, versionRepository, transactionManager, publisher } = createBaseDeps({
      assignPlayerOrderAndIntervals: assignPlayer,
    });
    const service = new AssignPlayerOrderService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
    );

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
    const { repository, versionRepository, transactionManager, publisher } = createBaseDeps({
      manuallyFinalizeClassStartOrder: manualFinalize,
    });
    const service = new ManuallyFinalizeClassStartOrderService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
    );

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
    const { repository, versionRepository, transactionManager, publisher } = createBaseDeps({
      assignStartTimes,
    });
    const service = new AssignStartTimesService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
    );

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
    const { repository, versionRepository, transactionManager, publisher } = createBaseDeps({
      finalizeStartlist: finalize,
    });
    const service = new FinalizeStartlistService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
    );

    await service.execute({ startlistId: 'startlist-1' });

    expect(finalize).toHaveBeenCalled();
  });

  it('persists a new version when startlist emits version generated event', async () => {
    const confirmedAt = new Date('2024-02-02T00:00:00Z');
    const snapshot: StartlistSnapshot = {
      id: 'startlist-1',
      eventId: 'event-1',
      raceId: 'race-1',
      settings: undefined,
      laneAssignments: [],
      classAssignments: [],
      startTimes: [],
      status: StartlistStatus.FINALIZED,
    };

    const versionEvent = new StartlistVersionGeneratedEvent(
      'startlist-1',
      snapshot,
      confirmedAt,
    );

    const { repository, versionRepository, transactionManager, publisher } = createBaseDeps({
      finalizeStartlist: vi.fn(),
      toSnapshot: vi.fn(() => snapshot),
      pullDomainEvents: vi.fn(() => [versionEvent]),
    });

    const service = new FinalizeStartlistService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
    );

    await service.execute({ startlistId: 'startlist-1' });

    const saveMock = versionRepository.saveVersion as unknown as ReturnType<typeof vi.fn>;
    expect(saveMock).toHaveBeenCalledTimes(1);
    const callArgs = saveMock.mock.calls[0][0];
    expect(callArgs.snapshot).toEqual(snapshot);
    expect(callArgs.confirmedAt).toEqual(confirmedAt);
  });

  it('InvalidateStartTimesService passes reason', async () => {
    const invalidate = vi.fn();
    const { repository, versionRepository, transactionManager, publisher } = createBaseDeps({
      invalidateStartTimes: invalidate,
    });
    const service = new InvalidateStartTimesService(
      repository,
      versionRepository,
      transactionManager,
      publisher,
    );

    await service.execute({ startlistId: 'startlist-1', reason: 'manual' });

    expect(invalidate).toHaveBeenCalledWith('manual');
  });
});
