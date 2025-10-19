import LaneAssignmentWorkflow from '../workflow/LaneAssignmentWorkflow';
import { useStartlistStepGuard } from '../hooks/useStartlistStepGuard';

const LaneAssignmentStepPage = (): JSX.Element => {
  useStartlistStepGuard('lanes');

  return (
    <div className="card">
      <LaneAssignmentWorkflow />
    </div>
  );
};

export default LaneAssignmentStepPage;
