import { describe, expect, it, vi } from 'vitest';
import {
  StartlistSnapshot,
  StartlistStatus,
  StartlistVersion,
  StartlistVersionRepository,
} from '@startlist-management/domain';
import {
  StartlistNotFoundError,
  StartlistVersionNotFoundError,
} from '../errors.js';
import { StartlistReadRepository } from '../queries/StartlistReadRepository.js';
import { StartlistQueryServiceImpl } from '../queries/StartlistQueryService.js';

const baseSnapshot: StartlistSnapshot = {
  id: 'startlist-1',
  eventId: 'event-1',
  raceId: 'race-1',
  status: StartlistStatus.LANE_ORDER_ASSIGNED,
  laneAssignments: [],
  classAssignments: [],
  startTimes: [],
};

const withSettings = (overrides: Partial<StartlistSnapshot> = {}): StartlistSnapshot => ({
  ...baseSnapshot,
  settings: {
    eventId: 'event-1',
    startTime: '2024-01-01T10:00:00.000Z',
    intervals: {
      laneClass: { milliseconds: 600000 },
      classPlayer: { milliseconds: 300000 },
    },
    laneCount: 2,
  },
  ...overrides,
});

const createVersion = (version: number, snapshot: StartlistSnapshot, confirmedAt: string): StartlistVersion => ({
  version,
  snapshot,
  confirmedAt: new Date(confirmedAt),
});

const snapshotV1 = withSettings({ status: StartlistStatus.SETTINGS_ENTERED });
const snapshotV2 = withSettings({ status: StartlistStatus.LANE_ORDER_ASSIGNED });
const snapshotV3 = withSettings({
  status: StartlistStatus.START_TIMES_ASSIGNED,
  startTimes: [{ playerId: 'p1', startTime: '2024-01-01T10:00:00.000Z', laneNumber: 1 }],
});

const versions: StartlistVersion[] = [
  createVersion(1, snapshotV1, '2024-01-01T10:00:00.000Z'),
  createVersion(2, snapshotV2, '2024-01-02T10:00:00.000Z'),
  createVersion(3, snapshotV3, '2024-01-03T10:00:00.000Z'),
];

const createService = (
  options: {
    snapshot?: StartlistSnapshot;
    versionHistory?: StartlistVersion[];
  } = {},
) => {
  const readRepository: StartlistReadRepository = {
    findById: vi.fn().mockResolvedValue(options.snapshot ?? snapshotV3),
  };

  const versionRepository: StartlistVersionRepository = {
    findVersions: vi.fn().mockResolvedValue(options.versionHistory ?? versions),
    saveVersion: vi.fn(),
  };

  const service = new StartlistQueryServiceImpl(readRepository, versionRepository);
  return { service, readRepository, versionRepository };
};

describe('StartlistQueryService', () => {
  it('returns snapshot when no additional data is requested', async () => {
    const { service } = createService();

    const result = await service.execute({ startlistId: 'startlist-1' });

    expect(result).toEqual(snapshotV3);
    expect(result).not.toHaveProperty('versions');
    expect(result).not.toHaveProperty('diff');
  });

  it('includes recent version summaries when requested', async () => {
    const { service } = createService();

    const result = await service.execute({ startlistId: 'startlist-1', includeVersions: true, versionLimit: 2 });

    expect(result.versions).toEqual([
      { version: 3, confirmedAt: '2024-01-03T10:00:00.000Z' },
      { version: 2, confirmedAt: '2024-01-02T10:00:00.000Z' },
    ]);
  });

  it('computes diffs against the previous version by default', async () => {
    const { service } = createService();

    const result = await service.execute({ startlistId: 'startlist-1', includeDiff: true });

    expect(result.diff?.to.version).toBe(3);
    expect(result.diff?.from?.version).toBe(2);
    expect(result.diff?.changes.startTimes?.current).toHaveLength(1);
  });

  it('allows selecting custom diff range', async () => {
    const { service } = createService();

    const diff = await service.diff({ startlistId: 'startlist-1', fromVersion: 1, toVersion: 3 });

    expect(diff?.to.version).toBe(3);
    expect(diff?.from?.version).toBe(1);
    expect(diff?.changes.status?.previous).toBe(StartlistStatus.SETTINGS_ENTERED);
  });

  it('provides paginated version lists sorted by newest first', async () => {
    const { service } = createService();

    const result = await service.listVersions({ startlistId: 'startlist-1', limit: 2, offset: 0 });

    expect(result.total).toBe(3);
    expect(result.items.map((item) => item.version)).toEqual([3, 2]);
  });

  it('throws when startlist is missing', async () => {
    const { service, readRepository } = createService({ snapshot: undefined });
    (readRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(service.execute({ startlistId: 'missing' })).rejects.toBeInstanceOf(StartlistNotFoundError);
  });

  it('throws when requested diff version does not exist', async () => {
    const { service } = createService();

    await expect(service.diff({ startlistId: 'startlist-1', toVersion: 99 })).rejects.toBeInstanceOf(
      StartlistVersionNotFoundError,
    );
  });
});
