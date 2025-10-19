import ClassOrderStep from '../components/ClassOrderStep';
import { useStartlistStepGuard } from '../hooks/useStartlistStepGuard';

const ClassOrderStepPage = (): JSX.Element => {
  useStartlistStepGuard('order');

  return (
    <div className="card">
      <ClassOrderStep />
    </div>
  );
};

export default ClassOrderStepPage;
