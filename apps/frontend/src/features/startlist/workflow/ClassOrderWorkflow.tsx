import ClassOrderStep from '../components/ClassOrderStep';
import { useClassOrderController } from './hooks/useClassOrderController';

const ClassOrderWorkflow = (): JSX.Element => {
  const {
    viewModel,
    activeTab,
    sensors,
    statuses,
    loadingStartTimes,
    onTabChange,
    onMove,
    onDragEnd,
    onExportCsv,
    onBack,
    entryMap,
    splitLookup,
  } = useClassOrderController();

  return (
    <ClassOrderStep
      tabs={viewModel.tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      classTabMap={viewModel.classTabMap}
      startTimeRowsByClass={viewModel.startTimeRowsByClass}
      classSummaries={viewModel.classSummaries}
      warningSummaries={viewModel.warningSummaries}
      avoidConsecutiveClubs={viewModel.avoidConsecutiveClubs}
      sensors={sensors}
      onDragEnd={onDragEnd}
      onMove={onMove}
      onExportCsv={onExportCsv}
      onBack={onBack}
      statuses={statuses}
      loadingStartTimes={loadingStartTimes}
      entryMap={entryMap}
      splitLookup={splitLookup}
    />
  );
};

export default ClassOrderWorkflow;
