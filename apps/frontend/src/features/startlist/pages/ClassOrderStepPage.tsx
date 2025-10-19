import ClassOrderWorkflow from '../workflow/ClassOrderWorkflow';
import { useStartlistStepGuard } from '../hooks/useStartlistStepGuard';

const ClassOrderStepPage = (): JSX.Element => {
  useStartlistStepGuard('order');

  return (
    <div className="card">
      <ClassOrderWorkflow />
    </div>
  );
};

export default ClassOrderStepPage;
