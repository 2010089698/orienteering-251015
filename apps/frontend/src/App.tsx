import { useState } from 'react';
import StepIndicator from './components/StepIndicator';
import InputStep from './components/InputStep';
import LaneAssignmentStep from './components/LaneAssignmentStep';
import ClassOrderStep from './components/ClassOrderStep';

const stepLabels = ['入力', 'レーン調整', '順序と時間'];

const App = (): JSX.Element => {
  const [step, setStep] = useState(1);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>スタートリスト作成ガイド</h1>
          <p className="muted">3 つのステップを順に進めると、スタートリストが完成します。</p>
        </div>
        <StepIndicator current={step} steps={stepLabels} />
      </header>
      <main className="content">
        <div className="card">
          {step === 1 && <InputStep onComplete={() => setStep(2)} />}
          {step === 2 && <LaneAssignmentStep onBack={() => setStep(1)} onConfirm={() => setStep(3)} />}
          {step === 3 && <ClassOrderStep onBack={() => setStep(2)} />}
        </div>
      </main>
    </div>
  );
};

export default App;
