import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useStartlistClassAssignments,
  useStartlistLaneAssignments,
  useStartlistStartTimes,
  useStartlistStatuses,
} from '../state/StartlistContext';
import { STARTLIST_STEP_PATHS, type StartlistStepKey } from '../routes';

const redirectTargets: Record<Exclude<StartlistStepKey, 'input'>, string> = {
  lanes: STARTLIST_STEP_PATHS.input,
  order: STARTLIST_STEP_PATHS.lanes,
  link: STARTLIST_STEP_PATHS.order,
};

export const useStartlistStepGuard = (step: StartlistStepKey): void => {
  const navigate = useNavigate();
  const location = useLocation();
  const laneAssignments = useStartlistLaneAssignments();
  const classAssignments = useStartlistClassAssignments();
  const startTimes = useStartlistStartTimes();
  const statuses = useStartlistStatuses();
  const laneStatusLevel = statuses.lanes.level;
  const classStatusLevel = statuses.classes.level;
  const startTimesStatusLevel = statuses.startTimes.level;
  const snapshotStatusLevel = statuses.snapshot.level;
  const [isGuardInitialized, setIsGuardInitialized] = useState(false);

  useEffect(() => {
    setIsGuardInitialized(true);
  }, []);

  useEffect(() => {
    if (!isGuardInitialized) {
      return;
    }
    if (step === 'lanes') {
      const isLaneStepReady = laneAssignments.length > 0 || laneStatusLevel === 'success';
      if (!isLaneStepReady && location.pathname !== STARTLIST_STEP_PATHS.input) {
        navigate(redirectTargets.lanes, { replace: true });
      }
      return;
    }
    if (step === 'order') {
      const canProceed =
        (classAssignments.length > 0 || classStatusLevel === 'success') &&
        (startTimes.length > 0 || startTimesStatusLevel === 'success');
      if (!canProceed && location.pathname !== redirectTargets.order) {
        navigate(redirectTargets.order, { replace: true });
      }
      return;
    }
    if (step === 'link') {
      const isFinalized = snapshotStatusLevel === 'success';
      if (!isFinalized && location.pathname !== redirectTargets.link) {
        navigate(redirectTargets.link, { replace: true });
      }
      return;
    }
  }, [
    classAssignments.length,
    classStatusLevel,
    laneAssignments.length,
    laneStatusLevel,
    isGuardInitialized,
    location.pathname,
    navigate,
    snapshotStatusLevel,
    startTimesStatusLevel,
    startTimes.length,
    step,
  ]);
};

export default useStartlistStepGuard;
