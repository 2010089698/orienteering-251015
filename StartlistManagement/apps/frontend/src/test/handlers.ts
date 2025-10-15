import { http, HttpResponse } from 'msw';
import type {
  ClassAssignmentDto,
  LaneAssignmentDto,
  StartTimeDto,
  StartlistSettingsDto,
} from '@startlist-management/application';

export interface MockSnapshot {
  settings?: StartlistSettingsDto;
  laneAssignments?: LaneAssignmentDto[];
  classAssignments?: ClassAssignmentDto[];
  startTimes?: StartTimeDto[];
  [key: string]: unknown;
}

export const createSnapshot = (overrides: Partial<MockSnapshot> = {}): MockSnapshot => ({
  settings: {
    eventId: 'mock-event',
    startTime: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    interval: { milliseconds: 60000 },
    laneCount: 2,
  },
  laneAssignments: [],
  classAssignments: [],
  startTimes: [],
  ...overrides,
});

const snapshotStore: Record<string, MockSnapshot> = {};

const persistSnapshot = (startlistId: string, snapshot: MockSnapshot | undefined) => {
  if (snapshot) {
    snapshotStore[startlistId] = snapshot;
  }
};

export const handlers = [
  http.post('/api/startlists/:startlistId/settings', async ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const settings = (await request.json()) as StartlistSettingsDto;
    const snapshot = createSnapshot({ settings });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.get('/api/startlists/:startlistId', ({ params }) => {
    const { startlistId } = params as { startlistId: string };
    const snapshot = snapshotStore[startlistId] ?? createSnapshot();
    return HttpResponse.json(snapshot);
  }),
  http.post('/api/startlists/:startlistId/lane-order', async ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const { assignments } = (await request.json()) as { assignments: LaneAssignmentDto[] };
    const snapshot = createSnapshot({ laneAssignments: assignments });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.post('/api/startlists/:startlistId/player-order', async ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const { assignments } = (await request.json()) as { assignments: ClassAssignmentDto[] };
    const snapshot = createSnapshot({ classAssignments: assignments });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.post('/api/startlists/:startlistId/start-times', async ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const { startTimes } = (await request.json()) as { startTimes: StartTimeDto[] };
    const snapshot = createSnapshot({ startTimes });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.post('/api/startlists/:startlistId/finalize', ({ params }) => {
    const { startlistId } = params as { startlistId: string };
    const snapshot = createSnapshot({ finalized: true });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
  http.post('/api/startlists/:startlistId/start-times/invalidate', async ({ params, request }) => {
    const { startlistId } = params as { startlistId: string };
    const { reason } = (await request.json()) as { reason: string };
    const snapshot = createSnapshot({ invalidatedReason: reason, startTimes: [] });
    persistSnapshot(startlistId, snapshot);
    return HttpResponse.json(snapshot);
  }),
];
