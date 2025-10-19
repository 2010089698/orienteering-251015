import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useStartlistClassAssignments,
  useStartlistLaneAssignments,
  useStartlistStartTimes,
} from '../state/StartlistContext';
import { STARTLIST_STEP_PATHS, type StartlistStepKey } from '../routes';

const redirectTargets: Record<Exclude<StartlistStepKey, 'input'>, string> = {
  lanes: STARTLIST_STEP_PATHS.input,
  order: STARTLIST_STEP_PATHS.lanes,
};

export const useStartlistStepGuard = (step: StartlistStepKey): void => {
  const navigate = useNavigate();
  const location = useLocation();
  const laneAssignments = useStartlistLaneAssignments();
  const classAssignments = useStartlistClassAssignments();
  const startTimes = useStartlistStartTimes();

  useEffect(() => {
    if (step === 'lanes') {
      if (laneAssignments.length === 0 && location.pathname !== STARTLIST_STEP_PATHS.input) {
        navigate(redirectTargets.lanes, { replace: true });
      }
      return;
    }
    if (step === 'order') {
      const canProceed = classAssignments.length > 0 && startTimes.length > 0;
      if (!canProceed && location.pathname !== redirectTargets.order) {
        navigate(redirectTargets.order, { replace: true });
      }
    }
  }, [
    classAssignments.length,
    laneAssignments.length,
    location.pathname,
    navigate,
    startTimes.length,
    step,
  ]);
};

export default useStartlistStepGuard;
