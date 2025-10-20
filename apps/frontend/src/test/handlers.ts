import { http, HttpResponse } from 'msw';
import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
  StartlistWithHistoryDto,
  StartlistDiffDto,
} from '@startlist-management/application';

interface MockVersion {
  version: number;
  confirmedAt: string;
  snapshot: StartlistWithHistoryDto;
}

export const createSnapshot = (overrides: Partial<StartlistWithHistoryDto> = {}): StartlistWithHistoryDto => ({
  id: overrides.id ?? 'mock-startlist',
  status: overrides.status ?? 'SETTINGS_ENTERED',
  settings:
    overrides.settings ??
    ({
      eventId: 'mock-event',
      startTime: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      intervals: {
        laneClass: { milliseconds: 60000 },
        classPlayer: { milliseconds: 45000 },
      },
      laneCount: 2,
    } satisfies StartlistSettingsDto),
  laneAssignments: overrides.laneAssignments ?? [],
  classAssignments: overrides.classAssignments ?? [],
  startTimes: overrides.startTimes ?? [],
  versions: overrides.versions,
  diff: overrides.diff,
});

const snapshotStore: Record<string, StartlistWithHistoryDto> = {};
const versionStore: Record<string, MockVersion[]> = {};

const persistSnapshot = (startlistId: string, snapshot: StartlistWithHistoryDto | undefined) => {
  if (!snapshot) {
    return;
  }
  snapshotStore[startlistId] = snapshot;
  const history = versionStore[startlistId] ?? [];
  const nextVersion = history.length + 1;
  const confirmedAt = new Date().toISOString();
  const snapshotCopy = JSON.parse(JSON.stringify(snapshot)) as StartlistWithHistoryDto;
  versionStore[startlistId] = [...history, { version: nextVersion, confirmedAt, snapshot: snapshotCopy }];
};

const buildDiff = (startlistId: string, history: MockVersion[], fromVersion?: number, toVersion?: number): StartlistDiffDto => {
  if (!history.length) {
    return {
      startlistId,
      to: { version: 0, confirmedAt: new Date().toISOString() },
      changes: {},
    };
  }

  const to = toVersion ? history.find((version) => version.version === toVersion) ?? history[history.length - 1] : history[history.length - 1];
  const from = fromVersion ? history.find((version) => version.version === fromVersion) : history[history.length - 2];

  return {
    startlistId,
    to: { version: to.version, confirmedAt: to.confirmedAt },
    ...(from ? { from: { version: from.version, confirmedAt: from.confirmedAt } } : {}),
    changes: {},
  };
};

export const handlers = [
  http.post('/api/startlists/:startlistId/settings', async ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const settings = (await request.json()) as StartlistSettingsDto;
    const snapshot = createSnapshot({
      id: startlistId,
      settings,
      status: 'SETTINGS_ENTERED',
    });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.get('/api/startlists/:startlistId', ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const base = snapshotStore[startlistId] ?? createSnapshot({ id: startlistId });
    const url = new URL(request.url);
    const includeVersions = url.searchParams.get('includeVersions') === 'true';
    const includeDiff = url.searchParams.get('includeDiff') === 'true';
    const versionLimit = url.searchParams.get('versionLimit');
    const diffFrom = url.searchParams.get('diffFromVersion');
    const diffTo = url.searchParams.get('diffToVersion');

    const response: StartlistWithHistoryDto = {
      ...base,
      versions: includeVersions
        ? (versionStore[startlistId] ?? [])
            .slice(-(Number.parseInt(versionLimit ?? '2', 10)))
            .map((version) => ({ version: version.version, confirmedAt: version.confirmedAt }))
            .reverse()
        : undefined,
      diff: includeDiff
        ? buildDiff(
            startlistId,
            versionStore[startlistId] ?? [],
            diffFrom ? Number.parseInt(diffFrom, 10) : undefined,
            diffTo ? Number.parseInt(diffTo, 10) : undefined,
          )
        : undefined,
    };
    return HttpResponse.json(response);
  }),
  http.post('/api/startlists/:startlistId/lane-order', async ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const { assignments } = (await request.json()) as { assignments: LaneAssignmentDto[] };
    const snapshot = createSnapshot({
      id: startlistId,
      laneAssignments: assignments,
      status: 'LANE_ORDER_ASSIGNED',
    });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.post('/api/startlists/:startlistId/player-order', async ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const { assignments } = (await request.json()) as { assignments: ClassAssignmentDto[] };
    const snapshot = createSnapshot({
      id: startlistId,
      classAssignments: assignments,
      status: 'PLAYER_ORDER_ASSIGNED',
    });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.post('/api/startlists/:startlistId/start-times', async ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const { startTimes } = (await request.json()) as { startTimes: StartTimeDto[] };
    const snapshot = createSnapshot({
      id: startlistId,
      startTimes,
      status: 'START_TIMES_ASSIGNED',
    });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.post('/api/startlists/:startlistId/finalize', ({ params }) => {
    const { startlistId } = params as { startlistId: string };
    const snapshot = createSnapshot({ id: startlistId, status: 'FINALIZED' });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.post('/api/startlists/:startlistId/start-times/invalidate', async ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const { reason } = (await request.json()) as { reason: string };
    const snapshot = createSnapshot({
      id: startlistId,
      startTimes: [],
      status: 'LANE_ORDER_ASSIGNED',
    });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.get('/api/startlists/:startlistId/versions', ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '0', 10) || undefined;
    const offset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0;
    const history = versionStore[startlistId] ?? [];
    const sliced = history.slice(offset, limit ? offset + limit : undefined);
    return HttpResponse.json({
      startlistId,
      total: history.length,
      items: sliced.map((version) => ({
        version: version.version,
        confirmedAt: version.confirmedAt,
        snapshot: version.snapshot,
      })),
    });
  }),
  http.get('/api/startlists/:startlistId/diff', ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const url = new URL(request.url);
    const fromVersion = url.searchParams.get('fromVersion');
    const toVersion = url.searchParams.get('toVersion');
    const diff = buildDiff(
      startlistId,
      versionStore[startlistId] ?? [],
      fromVersion ? Number.parseInt(fromVersion, 10) : undefined,
      toVersion ? Number.parseInt(toVersion, 10) : undefined,
    );
    return HttpResponse.json(diff);
  }),
];
