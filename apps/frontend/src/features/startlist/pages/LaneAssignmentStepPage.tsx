import LaneAssignmentStep from '../components/LaneAssignmentStep';
import { useStartlistStepGuard } from '../hooks/useStartlistStepGuard';

const LaneAssignmentStepPage = (): JSX.Element => {
  useStartlistStepGuard('lanes');

  return (
    <div className="card">
      <LaneAssignmentStep />
    </div>
  );
};

export default LaneAssignmentStepPage;
