import { useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import StepIndicator from '../components/StepIndicator';
import {
  useStartlistClassAssignments,
  useStartlistLaneAssignments,
  useStartlistStartTimes,
  useStartlistDispatch,
  useStartlistEventContext,
  setEventContext,
} from '../state/StartlistContext';
import { STARTLIST_BASE_PATH, STARTLIST_STEP_SEQUENCE } from '../routes';
import { useStartlistStatuses } from '../state/StartlistContext';

const stepLabels = ['入力', 'レーン調整', '順序と時間', 'イベント連携'];

const StartlistWorkflowPage = (): JSX.Element => {
  const laneAssignments = useStartlistLaneAssignments();
  const classAssignments = useStartlistClassAssignments();
  const startTimes = useStartlistStartTimes();
  const statuses = useStartlistStatuses();
  const dispatch = useStartlistDispatch();
  const eventContext = useStartlistEventContext();
  const [searchParams] = useSearchParams();
  const eventIdParam = searchParams.get('eventId') ?? undefined;
  const raceIdParam = searchParams.get('raceId') ?? undefined;
  const isFinalized = statuses.snapshot.level === 'success';

  useEffect(() => {
    const nextEventId = eventIdParam ?? eventContext.eventId;
    const nextRaceId = raceIdParam ?? eventContext.raceId;

    if (nextEventId === undefined && nextRaceId === undefined) {
      return;
    }

    if (eventContext.eventId === nextEventId && eventContext.raceId === nextRaceId) {
      return;
    }

    setEventContext(dispatch, { eventId: nextEventId, raceId: nextRaceId });
  }, [dispatch, eventContext.eventId, eventContext.raceId, eventIdParam, raceIdParam]);

  const steps = STARTLIST_STEP_SEQUENCE.map((step, index) => {
    const label = stepLabels[index];
    switch (step) {
      case 'lanes':
        return {
          label,
          path: step,
          isEnabled: laneAssignments.length > 0,
        };
      case 'order':
        return {
          label,
          path: step,
          isEnabled: classAssignments.length > 0 && startTimes.length > 0,
        };
      case 'link':
        return {
          label,
          path: step,
          isEnabled: isFinalized,
        };
      default:
        return {
          label,
          path: step,
          isEnabled: true,
        };
    }
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>スタートリスト作成ガイド</h1>
          <p className="muted">3 つのステップを順に進めると、スタートリストが完成します。</p>
        </div>
        <StepIndicator steps={steps} basePath={STARTLIST_BASE_PATH} />
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
};

export default StartlistWorkflowPage;
