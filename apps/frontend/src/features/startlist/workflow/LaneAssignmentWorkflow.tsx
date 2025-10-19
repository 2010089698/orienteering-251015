import LaneAssignmentStep from '../components/LaneAssignmentStep';
import { useLaneAssignmentController } from './hooks/useLaneAssignmentController';

const LaneAssignmentWorkflow = (): JSX.Element => {
  const {
    viewModel,
    activeTab,
    sensors,
    statuses,
    onTabChange,
    onLaneChange,
    onDragEnd,
    onConfirm,
    onBack,
    activePanelId,
    focusedLane,
  } = useLaneAssignmentController();

  return (
    <LaneAssignmentStep
      tabs={viewModel.tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      lanesWithSummaries={viewModel.lanesWithSummaries}
      laneOptions={viewModel.laneOptions}
      laneRows={viewModel.laneRows}
      sensors={sensors}
      onLaneChange={onLaneChange}
      onDragEnd={onDragEnd}
      onConfirm={onConfirm}
      onBack={onBack}
      statuses={statuses}
      focusedLane={focusedLane}
      activePanelId={activePanelId}
    />
  );
};

export default LaneAssignmentWorkflow;
