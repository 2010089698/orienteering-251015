import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useEffect } from 'react';
import {
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  type NavigateFunction,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { createSuccessStatus, renderWithStartlist } from './test-utils';
import StartlistWorkflowPage from '../pages/StartlistWorkflowPage';
import InputStepPage from '../pages/InputStepPage';
import LaneAssignmentStepPage from '../pages/LaneAssignmentStepPage';
import ClassOrderStepPage from '../pages/ClassOrderStepPage';
import StartlistLinkPage from '../pages/StartlistLinkPage';
import { STARTLIST_STEP_PATHS } from '../routes';
import { useStartlistEventContext } from '../state/StartlistContext';

const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-path">{location.pathname}</div>
      <div data-testid="current-search">{location.search}</div>
    </>
  );
};

const QueryPreservingNavigate = ({ to }: { to: string }) => {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
};

const LayoutWithLocation = ({ onNavigateReady }: { onNavigateReady?: (navigate: NavigateFunction) => void }): JSX.Element => {
  const navigate = useNavigate();
  const eventContext = useStartlistEventContext();

  useEffect(() => {
    onNavigateReady?.(navigate);
  }, [navigate, onNavigateReady]);

  return (
    <>
      <LocationProbe />
      <div data-testid="event-context">{JSON.stringify(eventContext)}</div>
      <Outlet />
    </>
  );
};

type RenderWorkflowOptions = Parameters<typeof renderWithStartlist>[1] & {
  onNavigateReady?: (navigate: NavigateFunction) => void;
};

const renderWorkflow = (initialEntries: string[], options?: RenderWorkflowOptions) => {
  const { onNavigateReady, ...renderOptions } = options ?? {};

  return renderWithStartlist(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/startlist" element={<StartlistWorkflowPage />}>
          <Route element={<LayoutWithLocation onNavigateReady={onNavigateReady} />}>
            <Route index element={<QueryPreservingNavigate to="input" />} />
            <Route path="input" element={<InputStepPage />} />
            <Route path="lanes" element={<LaneAssignmentStepPage />} />
            <Route path="order" element={<ClassOrderStepPage />} />
            <Route path="link" element={<StartlistLinkPage />} />
            <Route path="*" element={<QueryPreservingNavigate to="input" />} />
          </Route>
        </Route>
        <Route path="*" element={<QueryPreservingNavigate to={STARTLIST_STEP_PATHS.input} />} />
      </Routes>
    </MemoryRouter>,
    renderOptions,
  );
};

describe('Startlist workflow routing', () => {
  it('redirects lanes route to input when lane assignments are missing', async () => {
    renderWorkflow(['/startlist/lanes'], {
      initialState: { startlistId: 'SL-1' },
    });

    expect(await screen.findByRole('heading', { name: 'STEP 1 入力内容の整理' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(STARTLIST_STEP_PATHS.input);
  });

  it('keeps lanes route when lane status already indicates success', async () => {
    let capturedNavigate: NavigateFunction | undefined;

    renderWorkflow(['/startlist/input'], {
      initialState: {
        startlistId: 'SL-1',
        statuses: { lanes: createSuccessStatus('done') },
      },
      onNavigateReady: (navigate) => {
        capturedNavigate = navigate;
      },
    });

    expect(await screen.findByRole('heading', { name: 'STEP 1 入力内容の整理' })).toBeInTheDocument();

    await waitFor(() => {
      expect(capturedNavigate).toBeDefined();
    });

    act(() => {
      capturedNavigate?.('/startlist/lanes');
    });

    expect(await screen.findByRole('heading', { name: 'STEP 2 レーン割り当ての調整' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(STARTLIST_STEP_PATHS.lanes);
  });

  it('redirects order route to lanes until class order is prepared', async () => {
    renderWorkflow(['/startlist/order'], {
      initialState: {
        startlistId: 'SL-1',
        laneAssignments: [{ laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } }],
      },
    });

    expect(await screen.findByRole('heading', { name: 'STEP 2 レーン割り当ての調整' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(STARTLIST_STEP_PATHS.lanes);
  });

  it('keeps order route when STEP2 statuses indicate success', async () => {
    let capturedNavigate: NavigateFunction | undefined;

    renderWorkflow(['/startlist/input'], {
      initialState: {
        startlistId: 'SL-1',
        laneAssignments: [{ laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } }],
        classAssignments: [{ classId: 'M21', playerOrder: ['p1'] }],
        startTimes: [{ playerId: 'p1', startTime: new Date('2024-01-01T09:00:00Z').toISOString(), laneNumber: 1 }],
        statuses: {
          classes: createSuccessStatus('done'),
          startTimes: createSuccessStatus('done'),
        },
      },
      onNavigateReady: (navigate) => {
        capturedNavigate = navigate;
      },
    });

    expect(await screen.findByRole('heading', { name: 'STEP 1 入力内容の整理' })).toBeInTheDocument();

    await waitFor(() => {
      expect(capturedNavigate).toBeDefined();
    });

    act(() => {
      capturedNavigate?.('/startlist/order');
    });

    expect(await screen.findByRole('heading', { name: 'STEP 3 クラス内順序とスタート時間' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(STARTLIST_STEP_PATHS.order);
  });

  it('progresses through nested routes and keeps history in sync', async () => {
    const user = userEvent.setup();
    renderWorkflow(['/startlist/input'], {
      initialState: {
        startlistId: 'SL-1',
        settings: {
          eventId: 'event-1',
          startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
          intervals: {
            laneClass: { milliseconds: 60000 },
            classPlayer: { milliseconds: 60000 },
          },
          laneCount: 2,
        },
        entries: [
          { id: 'entry-1', name: 'A', classId: 'M21', cardNo: '1' },
          { id: 'entry-2', name: 'B', classId: 'W21', cardNo: '2' },
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: '入力完了（レーンを自動作成）' }));
    expect(await screen.findByRole('heading', { name: 'STEP 2 レーン割り当ての調整' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(STARTLIST_STEP_PATHS.lanes);

    const confirmButton = screen.getByRole('button', { name: '割り当て確定（順番と時間を作成）' });
    await user.click(confirmButton);

    expect(await screen.findByRole('heading', { name: 'STEP 3 クラス内順序とスタート時間' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(STARTLIST_STEP_PATHS.order);

    const indicator = screen.getByRole('list', { name: '進行状況' });
    const inputStepButton = within(indicator).getByRole('button', { name: /入力/ });
    await user.click(inputStepButton);

    expect(await screen.findByRole('heading', { name: 'STEP 1 入力内容の整理' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(STARTLIST_STEP_PATHS.input);
  });

  it('redirects link route to order until the snapshot is finalized', async () => {
    const laneAssignments = [{ laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } }];
    const classAssignments = [{ classId: 'M21', playerOrder: ['p1'] }];
    const startTimes = [{ playerId: 'p1', startTime: new Date('2024-01-01T09:00:00Z').toISOString(), laneNumber: 1 }];

    renderWorkflow(['/startlist/link'], {
      initialState: {
        startlistId: 'SL-1',
        settings: {
          eventId: 'event-1',
          startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
          intervals: {
            laneClass: { milliseconds: 60000 },
            classPlayer: { milliseconds: 60000 },
          },
          laneCount: 1,
        },
        laneAssignments,
        classAssignments,
        startTimes,
      },
    });

    expect(await screen.findByRole('heading', { name: 'STEP 3 クラス内順序とスタート時間' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(STARTLIST_STEP_PATHS.order);
  });

  it('allows navigating to the link page once the snapshot status is success', async () => {
    const laneAssignments = [{ laneNumber: 1, classOrder: ['M21'], interval: { milliseconds: 60000 } }];
    const classAssignments = [{ classId: 'M21', playerOrder: ['p1'] }];
    const startTimes = [{ playerId: 'p1', startTime: new Date('2024-01-01T09:00:00Z').toISOString(), laneNumber: 1 }];

    renderWorkflow(['/startlist/link'], {
      initialState: {
        startlistId: 'SL-1',
        settings: {
          eventId: 'event-1',
          startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
          intervals: {
            laneClass: { milliseconds: 60000 },
            classPlayer: { milliseconds: 60000 },
          },
          laneCount: 1,
        },
        laneAssignments,
        classAssignments,
        startTimes,
        statuses: {
          classes: createSuccessStatus('classes ready'),
          startTimes: createSuccessStatus('times ready'),
          snapshot: createSuccessStatus('finalized'),
        },
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'スタートリストのイベント連携状況' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(STARTLIST_STEP_PATHS.link);
  });

  it('preserves query parameters when redirecting to the input step and initializes event context', async () => {
    renderWorkflow(['/startlist?eventId=event-123&raceId=race-456']);

    expect(await screen.findByRole('heading', { name: 'STEP 1 入力内容の整理' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(STARTLIST_STEP_PATHS.input);
    expect(await screen.findByTestId('current-search')).toHaveTextContent(
      '?eventId=event-123&raceId=race-456',
    );

    const eventContextElement = await screen.findByTestId('event-context');
    await waitFor(() => {
      expect(eventContextElement.textContent).toContain('event-123');
      expect(eventContextElement.textContent).toContain('race-456');
    });
  });
});
vi.mock('../../event-management/api/useEventManagementApi', () => ({
  useEventManagementApi: () => ({
    listEvents: vi.fn().mockResolvedValue([]),
    getEvent: vi.fn().mockResolvedValue({ id: 'event-1', name: 'Dummy', races: [] }),
    createEvent: vi.fn(),
    scheduleRace: vi.fn(),
  }),
}));

