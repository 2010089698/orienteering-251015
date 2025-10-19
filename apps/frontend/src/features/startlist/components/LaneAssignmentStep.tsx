import type { DndContextProps, DragEndEvent } from '@dnd-kit/core';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { StatusMessage } from '@orienteering/shared-ui';

import { Tabs } from '../../../components/tabs';
import ClassCard from './lane-assignment/ClassCard';
import LaneClassSummaryList from './lane-assignment/LaneClassSummaryList';
import LaneColumn from './lane-assignment/LaneColumn';
import LaneSummaryCard from './lane-assignment/LaneSummaryCard';
import type { LaneAssignmentTab, LaneWithSummary, LaneRow } from '../workflow/createLaneAssignmentViewModel';
import type { StatusMessageState } from '../state/types';

export type LaneAssignmentStatuses = Pick<
  Record<'lanes' | 'classes' | 'startTimes', StatusMessageState>,
  'lanes' | 'classes' | 'startTimes'
>;

export type LaneAssignmentStepProps = {
  tabs: LaneAssignmentTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  lanesWithSummaries: LaneWithSummary[];
  laneOptions: number[];
  laneRows: LaneRow[];
  sensors: DndContextProps['sensors'];
  onLaneChange: (classId: string, laneNumber: number) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onConfirm: () => void;
  onBack: () => void;
  statuses: LaneAssignmentStatuses;
  focusedLane?: LaneWithSummary;
  activePanelId: string;
};

const LaneAssignmentStep = ({
  tabs,
  activeTab,
  onTabChange,
  lanesWithSummaries,
  laneOptions,
  laneRows,
  sensors,
  onLaneChange,
  onDragEnd,
  onConfirm,
  onBack,
  statuses,
  focusedLane,
  activePanelId,
}: LaneAssignmentStepProps): JSX.Element => {
  return (
    <section aria-labelledby="step2-heading">
      <header>
        <h2 id="step2-heading">STEP 2 レーン割り当ての調整</h2>
        <p className="muted">
          クラスカードをドラッグ＆ドロップしてレーンの割り当てや順序を調整してください。各カードのセレクトボックスからもレーンを変更できます。
        </p>
      </header>
      {laneRows.length === 0 ? (
        <p className="muted">まだレーンが作成されていません。STEP 1 から進めてください。</p>
      ) : (
        <>
          <div className="lane-tabs">
            <Tabs
              activeId={activeTab}
              items={tabs.map((tab) => ({ id: tab.id, label: tab.label, panelId: tab.panelId }))}
              onChange={onTabChange}
              idPrefix="lanes"
              ariaLabel="レーン表示の切り替え"
            />
          </div>
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div
              className={activeTab === 'overview' ? 'lane-view lane-view--overview' : 'lane-view lane-view--focused'}
              role="tabpanel"
              id={activePanelId}
              aria-labelledby={`lanes-${activeTab}`}
              data-testid="lane-view"
            >
              {activeTab === 'overview' ? (
                <>
                  <div className="lane-board" data-testid="lane-board">
                    {lanesWithSummaries.map(({ lane, summary }) => (
                      <LaneColumn key={lane.laneNumber} lane={lane} summary={summary}>
                        <SortableContext items={lane.classOrder} strategy={verticalListSortingStrategy}>
                          <div className="lane-stack">
                            {lane.classOrder.length === 0 ? (
                              <p className="muted small-text">クラスをドラッグして割り当ててください。</p>
                            ) : (
                              summary.classSummaries.map((classSummary) => (
                                <ClassCard
                                  key={classSummary.classId}
                                  classId={classSummary.classId}
                                  laneNumber={lane.laneNumber}
                                  onLaneChange={onLaneChange}
                                  laneOptions={laneOptions}
                                  competitorCount={classSummary.competitorCount}
                                  timeRangeLabel={classSummary.timeRangeLabel}
                                  helperText={classSummary.helperText}
                                />
                              ))
                            )}
                          </div>
                        </SortableContext>
                      </LaneColumn>
                    ))}
                  </div>
                  <div className="lane-preview" data-testid="lane-preview">
                    {lanesWithSummaries.map(({ lane, summary }) => (
                      <LaneSummaryCard key={lane.laneNumber} laneNumber={lane.laneNumber} summary={summary} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="lane-focused-layout">
                  <div className="lane-board lane-board--single" data-testid="lane-board">
                    {focusedLane ? (
                      <LaneColumn lane={focusedLane.lane} summary={focusedLane.summary}>
                        <SortableContext
                          items={focusedLane.lane.classOrder}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="lane-stack">
                            {focusedLane.lane.classOrder.length === 0 ? (
                              <p className="muted small-text">クラスをドラッグして割り当ててください。</p>
                            ) : (
                              focusedLane.summary.classSummaries.map((classSummary) => (
                                <ClassCard
                                  key={classSummary.classId}
                                  classId={classSummary.classId}
                                  laneNumber={focusedLane.lane.laneNumber}
                                  onLaneChange={onLaneChange}
                                  laneOptions={laneOptions}
                                  competitorCount={classSummary.competitorCount}
                                  timeRangeLabel={classSummary.timeRangeLabel}
                                  helperText={classSummary.helperText}
                                />
                              ))
                            )}
                          </div>
                        </SortableContext>
                      </LaneColumn>
                    ) : (
                      <p className="muted small-text">このレーンは現在利用できません。</p>
                    )}
                  </div>
                  <aside className="lane-preview lane-preview--compact" data-testid="lane-preview">
                    <h3 className="lane-preview__title">割り当てプレビュー</h3>
                    <ul className="lane-preview__list">
                      {lanesWithSummaries.map(({ lane, summary }) => (
                        <li key={lane.laneNumber} className="lane-preview__item">
                          <span className="lane-preview__lane-label">レーン {lane.laneNumber}</span>
                          <div className="meta-info lane-card__meta">
                            <span className="meta-info__item">
                              <span className="meta-info__label">人数</span>
                              <span className="meta-info__value">{summary.competitorCount}名</span>
                            </span>
                            <span className="meta-info__item">
                              <span className="meta-info__label">時間帯</span>
                              <span className={`meta-info__value${summary.timeRangeLabel ? '' : ' is-muted'}`}>
                                {summary.timeRangeLabel ?? '未設定'}
                              </span>
                            </span>
                          </div>
                          <LaneClassSummaryList
                            summaries={summary.classSummaries}
                            emptyContent={<span className="lane-preview__lane-classes muted">クラス未設定</span>}
                          />
                        </li>
                      ))}
                    </ul>
                  </aside>
                </div>
              )}
            </div>
          </DndContext>
        </>
      )}
      <div className="actions-row step-actions">
        <button type="button" className="secondary" onClick={onBack}>
          戻る
        </button>
        <button type="button" onClick={onConfirm} disabled={laneRows.length === 0}>
          割り当て確定（順番と時間を作成）
        </button>
      </div>
      <StatusMessage tone={statuses.lanes.level} message={statuses.lanes.text} />
      <StatusMessage tone={statuses.classes.level} message={statuses.classes.text} />
      <StatusMessage tone={statuses.startTimes.level} message={statuses.startTimes.text} />
    </section>
  );
};

export default LaneAssignmentStep;
