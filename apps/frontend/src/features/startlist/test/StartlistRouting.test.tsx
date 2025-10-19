import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { renderWithStartlist } from './test-utils';
import StartlistWorkflowPage from '../pages/StartlistWorkflowPage';
import InputStepPage from '../pages/InputStepPage';
import LaneAssignmentStepPage from '../pages/LaneAssignmentStepPage';
import ClassOrderStepPage from '../pages/ClassOrderStepPage';
import { STARTLIST_STEP_PATHS } from '../routes';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
};

const LayoutWithLocation = (): JSX.Element => {
  return (
    <>
      <LocationProbe />
      <Outlet />
    </>
  );
};

const renderWorkflow = (initialEntries: string[], options?: Parameters<typeof renderWithStartlist>[1]) => {
  return renderWithStartlist(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/startlist" element={<StartlistWorkflowPage />}>
          <Route element={<LayoutWithLocation />}>
            <Route index element={<Navigate to="input" replace />} />
            <Route path="input" element={<InputStepPage />} />
            <Route path="lanes" element={<LaneAssignmentStepPage />} />
            <Route path="order" element={<ClassOrderStepPage />} />
            <Route path="*" element={<Navigate to="input" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={STARTLIST_STEP_PATHS.input} replace />} />
      </Routes>
    </MemoryRouter>,
    options,
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
});
