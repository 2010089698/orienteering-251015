import InputStep from '../components/InputStep';
import { useInputStepController } from './hooks/useInputStepController';

const InputStepWorkflow = (): JSX.Element => {
  const { viewModel, activeTab, status, onTabChange, onComplete, settingsForm } = useInputStepController();

  return (
    <InputStep
      tabs={viewModel.tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      filteredEntries={viewModel.filteredEntries}
      onSubmit={onComplete}
      status={status}
      settingsForm={settingsForm}
    />
  );
};

export default InputStepWorkflow;
