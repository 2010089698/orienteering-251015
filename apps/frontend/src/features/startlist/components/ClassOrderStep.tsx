import type { DndContextProps, DragEndEvent } from '@dnd-kit/core';
import { DndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, ReactNode } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';

import { Tabs } from '../../../components/tabs';
import ClassOrderPanel from './ClassOrderPanel';
import type {
  ClassOrderTabItem,
  ClassOrderWarningSummary,
  StartTimeRow,
} from '../workflow/createClassOrderViewModel';
import { playerItemId } from '../workflow/createClassOrderViewModel';
import type { Entry, StatusMessageState } from '../state/types';
import type { SplitClassLookup } from '../utils/splitUtils';

const ClassPlayerCard = ({
  classId,
  playerId,
  children,
}: {
  classId: string;
  playerId: string;
  children: ReactNode;
}): JSX.Element => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: playerItemId(classId, playerId),
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className={`player-row${isDragging ? ' is-dragging' : ''}`} {...attributes} {...listeners}>
      {children}
    </li>
  );
};

const DroppableList = ({
  assignment,
  children,
}: {
  assignment: ClassOrderTabItem['assignment'];
  children: ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `class-drop-${assignment.classId}` });
  return (
    <ol ref={setNodeRef} className={`order-list${isOver ? ' is-over' : ''}`}>
      {children}
    </ol>
  );
};

export type ClassOrderStepProps = {
  tabs: { id: string; label: string; panelId: string }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  classTabMap: Map<string, ClassOrderTabItem>;
  startTimeRowsByClass: Map<string, StartTimeRow[]>;
  classSummaries: Map<string, { count: number; firstStart?: string; lastStart?: string }>;
  warningSummaries: ClassOrderWarningSummary[];
  avoidConsecutiveClubs: boolean;
  sensors: DndContextProps['sensors'];
  onDragEnd: (event: DragEndEvent) => void;
  onMove: (classId: string, index: number, direction: number) => void;
  onExportCsv: () => void;
  onBack: () => void;
  statuses: Pick<Record<'startTimes', StatusMessageState>, 'startTimes'>;
  loadingStartTimes: boolean;
  entryMap: Map<string, Entry>;
  splitLookup: SplitClassLookup;
};

const ClassOrderStep = ({
  tabs,
  activeTab,
  onTabChange,
  classTabMap,
  startTimeRowsByClass,
  classSummaries,
  warningSummaries,
  avoidConsecutiveClubs,
  sensors,
  onDragEnd,
  onMove,
  onExportCsv,
  onBack,
  statuses,
  loadingStartTimes,
  entryMap,
  splitLookup,
}: ClassOrderStepProps): JSX.Element => {
  return (
    <section aria-labelledby="step3-heading">
      <header>
        <h2 id="step3-heading">STEP 3 クラス内順序とスタート時間</h2>
        <p className="muted">
          並び順をドラッグ＆ドロップまたはボタンで変更すると、スタート時間が自動で計算し直されます。スタート時刻はすべて日本時間 (JST) です。
        </p>
      </header>
      <ClassOrderPanel
        headingLevel="h3"
        headingId="class-order-config-heading"
        showAssignmentPreview={false}
        className="class-order-config"
      />
      {avoidConsecutiveClubs && warningSummaries.length > 0 && (
        <div className="class-order-warning">
          <StatusMessage
            tone="error"
            message="人数の組み合わせの都合で所属が連続するクラスがあります。下記をご確認ください。"
          />
          <ul className="class-order-warning__list">
            {warningSummaries.map((item) => (
              <li key={item.classId}>
                {splitLookup.formatClassLabel(item.classId)}
                {item.clubs.length > 0 ? `（${item.clubs.join('・')}）` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {tabs.length === 0 ? (
        <p className="muted">クラス内順序がまだ作成されていません。STEP 2 から進めてください。</p>
      ) : (
        <>
          <div className="class-order-tabs">
            <Tabs
              activeId={activeTab}
              items={tabs}
              onChange={onTabChange}
              idPrefix="class-tab"
              ariaLabel="クラス別の表示切り替え"
            />
          </div>
          <div className="class-order-panels">
            {tabs.map((item) => {
              const isActive = item.id === activeTab;
              const tabInfo = classTabMap.get(item.id);
              if (!tabInfo) {
                return null;
              }
              const rows = startTimeRowsByClass.get(tabInfo.assignment.classId) ?? [];
              const summary = classSummaries.get(tabInfo.assignment.classId);
              const metaParts = [`参加者 ${summary?.count ?? tabInfo.assignment.playerOrder.length}人`];
              if (summary?.firstStart) {
                if (summary.lastStart && summary.lastStart !== summary.firstStart) {
                  metaParts.push(`${summary.firstStart}〜${summary.lastStart}`);
                } else {
                  metaParts.push(summary.firstStart);
                }
              }
              const metaText = metaParts.join(' / ');

              return (
                <div
                  key={item.id}
                  id={item.panelId}
                  role="tabpanel"
                  aria-labelledby={`class-tab-${item.id}`}
                  hidden={!isActive}
                  className="class-order-panel class-order-panel--detail"
                >
                  {isActive ? (
                    <div className="class-order-layout">
                      <div className="class-order-layout__list">
                        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                          <div className="class-card">
                            <div className="class-card__header">
                              <h3>
                                {splitLookup.formatClassLabel(tabInfo.assignment.classId)}
                                {tabInfo.laneLabel ? `（${tabInfo.laneLabel}）` : ''}
                              </h3>
                              <p className="muted class-card__meta">{metaText}</p>
                            </div>
                            {tabInfo.assignment.playerOrder.length === 0 ? (
                              <p className="muted">参加者が登録されていません。</p>
                            ) : (
                              <SortableContext
                                items={tabInfo.assignment.playerOrder.map((playerId) =>
                                  playerItemId(tabInfo.assignment.classId, playerId),
                                )}
                                strategy={verticalListSortingStrategy}
                              >
                                <DroppableList assignment={tabInfo.assignment}>
                                  {tabInfo.assignment.playerOrder.map((playerId, index) => {
                                    const entry = entryMap.get(playerId);
                                    return (
                                      <ClassPlayerCard
                                        key={playerId}
                                        classId={tabInfo.assignment.classId}
                                        playerId={playerId}
                                      >
                                        <div className="order-row">
                                          <span>
                                            {entry?.name || '（名前未入力）'} | {entry?.club ?? '（所属未入力）'}
                                          </span>
                                          <span className="inline-buttons">
                                            <button
                                              type="button"
                                              className="secondary"
                                              onClick={() => onMove(tabInfo.assignment.classId, index, -1)}
                                              disabled={index === 0}
                                            >
                                              ↑
                                            </button>
                                            <button
                                              type="button"
                                              className="secondary"
                                              onClick={() => onMove(tabInfo.assignment.classId, index, 1)}
                                              disabled={index === tabInfo.assignment.playerOrder.length - 1}
                                            >
                                              ↓
                                            </button>
                                          </span>
                                        </div>
                                      </ClassPlayerCard>
                                    );
                                  })}
                                </DroppableList>
                              </SortableContext>
                            )}
                          </div>
                        </DndContext>
                      </div>
                      <div className="class-order-layout__table">
                        {rows.length > 0 ? (
                          <div className="table-wrapper">
                            <table>
                              <caption>
                                {tabInfo.laneLabel
                                  ? `${splitLookup.formatClassLabel(tabInfo.assignment.classId)}（${tabInfo.laneLabel}）のスタートリスト`
                                  : `${splitLookup.formatClassLabel(tabInfo.assignment.classId)} のスタートリスト`}
                              </caption>
                              <thead>
                                <tr>
                                  <th>スタート時刻</th>
                                  <th>氏名</th>
                                  <th>所属</th>
                                  <th>カード番号</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row) => (
                                  <tr key={row.playerId}>
                                    <td>{row.startTimeLabel}</td>
                                    <td>{row.name}</td>
                                    <td>{row.club}</td>
                                    <td>{row.cardNo}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="muted">スタート時間がまだ計算されていません。</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
      <div className="actions-row step-actions">
        <button
          type="button"
          className="secondary"
          onClick={onExportCsv}
          disabled={loadingStartTimes}
        >
          CSV をエクスポート
        </button>
        <button type="button" className="secondary" onClick={onBack}>
          戻る
        </button>
      </div>
      <StatusMessage tone={statuses.startTimes.level} message={statuses.startTimes.text} />
    </section>
  );
};

export default ClassOrderStep;
