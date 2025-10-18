import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createStatus,
  setStatus,
  updateClassAssignments,
  updateStartTimes,
  useStartlistDispatch,
  useStartlistState,
  setLoading,
} from '../state/StartlistContext';
import { calculateStartTimes, deriveClassOrderWarnings, updateClassPlayerOrder } from '../utils/startlistUtils';
import type { ClassAssignmentDto } from '@startlist-management/application';
import { Tabs } from '../../../components/tabs';
import { downloadStartlistCsv } from '../utils/startlistExport';
import ClassOrderPanel from './ClassOrderPanel';

type ClassOrderStepProps = {
  onBack: () => void;
};

const formatStartTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
    timeZoneName: 'short',
  });
};

const playerItemId = (classId: string, playerId: string) => `${classId}::${playerId}`;

const parsePlayerItemId = (value: string): { classId: string; playerId: string } | undefined => {
  const [classId, playerId] = value.split('::');
  if (!classId || !playerId) {
    return undefined;
  }
  return { classId, playerId };
};

type StartTimeRow = {
  playerId: string;
  cardNo: string;
  name: string;
  club: string;
  classId: string;
  laneNumber: number;
  startTimeIso: string;
  startTimeLabel: string;
  startTimeMs: number;
};

const createTabKey = (value: string): string => {
  const sanitized = value
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase();
  const hash = Array.from(value).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0).toString(16);
  return `class-${sanitized || 'id'}-${hash}`;
};

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

const DroppableList = ({ assignment, children }: { assignment: ClassAssignmentDto; children: ReactNode }): JSX.Element => {
  const { setNodeRef, isOver } = useDroppable({ id: `class-drop-${assignment.classId}` });
  return (
    <ol ref={setNodeRef} className={`order-list${isOver ? ' is-over' : ''}`}>
      {children}
    </ol>
  );
};

const ClassOrderStep = ({ onBack }: ClassOrderStepProps): JSX.Element => {
  const {
    classAssignments,
    startTimes,
    settings,
    laneAssignments,
    entries,
    statuses,
    loading,
    classOrderWarnings,
    classOrderPreferences,
    classSplitRules,
    classSplitResult,
  } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const entryMap = useMemo(() => {
    return new Map(entries.map((entry) => [entry.id, entry]));
  }, [entries]);

  const startTimeRowsByClass = useMemo(() => {
    const byClass = new Map<string, StartTimeRow[]>();
    startTimes.forEach((item) => {
      const entry = entryMap.get(item.playerId);
      const isoValue =
        typeof item.startTime === 'string' ? item.startTime : new Date(item.startTime).toISOString();
      const timestamp = new Date(isoValue).getTime();
      const row: StartTimeRow = {
        playerId: item.playerId,
        cardNo: entry?.cardNo ?? item.playerId,
        name: entry?.name ?? '（名前未入力）',
        club: entry?.club ?? '（所属未入力）',
        classId: entry?.classId ?? '不明',
        laneNumber: item.laneNumber,
        startTimeIso: isoValue,
        startTimeLabel: formatStartTime(isoValue),
        startTimeMs: Number.isNaN(timestamp) ? Number.NaN : timestamp,
      };
      const list = byClass.get(row.classId);
      if (list) {
        list.push(row);
      } else {
        byClass.set(row.classId, [row]);
      }
    });
    return byClass;
  }, [startTimes, entryMap]);

  const classSummaries = useMemo(
    () =>
      classAssignments.reduce(
        (acc, assignment) => {
          const rows = startTimeRowsByClass.get(assignment.classId) ?? [];
          let firstRow: StartTimeRow | undefined;
          let lastRow: StartTimeRow | undefined;
          rows.forEach((row) => {
            if (Number.isNaN(row.startTimeMs)) {
              return;
            }
            if (!firstRow || row.startTimeMs < firstRow.startTimeMs) {
              firstRow = row;
            }
            if (!lastRow || row.startTimeMs > lastRow.startTimeMs) {
              lastRow = row;
            }
          });
          acc.set(assignment.classId, {
            count: assignment.playerOrder.length,
            firstStart: firstRow?.startTimeLabel,
            lastStart: lastRow?.startTimeLabel ?? firstRow?.startTimeLabel,
          });
          return acc;
        },
        new Map<string, { count: number; firstStart?: string; lastStart?: string }>(),
      ),
    [classAssignments, startTimeRowsByClass],
  );

  const laneSortInfo = useMemo(() => {
    const map = new Map<string, { laneNumber?: number; sortKey: number }>();
    laneAssignments.forEach((lane) => {
      lane.classOrder.forEach((classId, index) => {
        map.set(classId, { laneNumber: lane.laneNumber, sortKey: lane.laneNumber * 1000 + index });
      });
    });
    return map;
  }, [laneAssignments]);

  const classTabItems = useMemo(() => {
    return classAssignments
      .map((assignment, index) => {
        const summary = classSummaries.get(assignment.classId);
        const laneInfo = laneSortInfo.get(assignment.classId);
        const laneLabel = laneInfo?.laneNumber ? `レーン${laneInfo.laneNumber}` : undefined;
        const metaParts = [laneLabel, `${assignment.playerOrder.length}人`];
        if (summary?.firstStart) {
          if (summary.lastStart && summary.lastStart !== summary.firstStart) {
            metaParts.push(`${summary.firstStart}〜${summary.lastStart}`);
          } else {
            metaParts.push(summary.firstStart);
          }
        }
        const labelMeta = metaParts.filter((part): part is string => Boolean(part));
        const tabId = createTabKey(assignment.classId);
        return {
          tabId,
          panelId: `${tabId}-panel`,
          label: `${assignment.classId}（${labelMeta.join('・')}）`,
          assignment,
          laneLabel,
          sortKey: laneInfo?.sortKey ?? Number.MAX_SAFE_INTEGER - (classAssignments.length - index),
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [classAssignments, classSummaries, laneSortInfo]);

  const tabItems = useMemo(
    () => classTabItems.map((item) => ({ id: item.tabId, label: item.label, panelId: item.panelId })),
    [classTabItems],
  );

  const classTabMap = useMemo(() => new Map(classTabItems.map((item) => [item.tabId, item])), [classTabItems]);

  const [activeTab, setActiveTab] = useState<string>(() => tabItems[0]?.id ?? '');

  useEffect(() => {
    if (tabItems.length === 0) {
      if (activeTab !== '') {
        setActiveTab('');
      }
      return;
    }
    if (!tabItems.some((item) => item.id === activeTab)) {
      setActiveTab(tabItems[0].id);
    }
  }, [activeTab, tabItems]);

  const avoidConsecutiveClubs = classOrderPreferences.avoidConsecutiveClubs;

  const warningSummaries = useMemo(() => {
    if (!avoidConsecutiveClubs) {
      return [] as { classId: string; clubs: string[] }[];
    }
    return classOrderWarnings.map((warning) => {
      const clubs = Array.from(
        new Set(warning.occurrences.flatMap((occurrence) => occurrence.clubs)),
      ).sort((a, b) => a.localeCompare(b, 'ja'));
      return { classId: warning.classId, clubs };
    });
  }, [classOrderWarnings, avoidConsecutiveClubs]);

  const reorderWithinClass = (classId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }
    const assignment = classAssignments.find((item) => item.classId === classId);
    if (!assignment || toIndex < 0 || toIndex > assignment.playerOrder.length) {
      return;
    }
    const nextAssignments = updateClassPlayerOrder(classAssignments, classId, fromIndex, toIndex);
    const warnings = avoidConsecutiveClubs
      ? deriveClassOrderWarnings(nextAssignments, entries, {
          splitRules: classSplitRules,
          previousSplitResult: classSplitResult,
        })
      : [];
    updateClassAssignments(dispatch, nextAssignments, undefined, warnings, classSplitResult);
    if (!settings) {
      return;
    }
    const nextStartTimes = calculateStartTimes({
      settings,
      laneAssignments,
      classAssignments: nextAssignments,
      entries,
      splitRules: classSplitRules,
      splitResult: classSplitResult,
    });
    updateStartTimes(dispatch, nextStartTimes, classSplitResult);
    setStatus(dispatch, 'classes', createStatus('順番を更新しました。', 'info'));
    setStatus(dispatch, 'startTimes', createStatus('スタート時間を再計算しました。', 'info'));
  };

  const handleMove = (classId: string, index: number, direction: number) => {
    const targetIndex = index + direction;
    const assignment = classAssignments.find((item) => item.classId === classId);
    if (!assignment || targetIndex < 0 || targetIndex >= assignment.playerOrder.length) {
      return;
    }
    reorderWithinClass(classId, index, targetIndex);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = typeof event.active.id === 'string' ? event.active.id : undefined;
    const overId = typeof event.over?.id === 'string' ? event.over.id : undefined;
    if (!activeId || !overId) {
      return;
    }
    if (activeId === overId) {
      return;
    }
    const active = parsePlayerItemId(activeId);
    const over = overId.startsWith('class-drop-') ? { classId: overId.replace('class-drop-', ''), playerId: '' } : parsePlayerItemId(overId);
    if (!active || !over || active.classId !== over.classId) {
      return;
    }
    const assignment = classAssignments.find((item) => item.classId === active.classId);
    if (!assignment) {
      return;
    }
    const fromIndex = assignment.playerOrder.indexOf(active.playerId);
    if (fromIndex === -1) {
      return;
    }
    const toIndex = over.playerId
      ? assignment.playerOrder.indexOf(over.playerId)
      : assignment.playerOrder.length - 1;
    if (toIndex === -1) {
      return;
    }
    reorderWithinClass(active.classId, fromIndex, toIndex);
  };

  const handleExportCsv = () => {
    if (startTimes.length === 0) {
      return;
    }

    setLoading(dispatch, 'startTimes', true);
    try {
      const count = downloadStartlistCsv({ entries, startTimes, classAssignments });
      setStatus(dispatch, 'startTimes', createStatus(`${count} 件のスタート時間をエクスポートしました。`, 'info'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV のエクスポートに失敗しました。';
      setStatus(dispatch, 'startTimes', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'startTimes', false);
    }
  };

  return (
    <section aria-labelledby="step3-heading">
      <header>
        <h2 id="step3-heading">STEP 3 クラス内順序とスタート時間</h2>
        <p className="muted">
          並び順をドラッグ＆ドロップまたはボタンで変更すると、スタート時間が自動で計算し直されます。スタート時刻はすべて日本時間 (JST)
          です。
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
                {item.classId}
                {item.clubs.length > 0 ? `（${item.clubs.join('・')}）` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {classAssignments.length === 0 ? (
        <p className="muted">クラス内順序がまだ作成されていません。STEP 2 から進めてください。</p>
      ) : (
        <>
          <div className="class-order-tabs">
            <Tabs
              activeId={activeTab}
              items={tabItems}
              onChange={setActiveTab}
              idPrefix="class-tab"
              ariaLabel="クラス別の表示切り替え"
            />
          </div>
          <div className="class-order-panels">
            {tabItems.map((item) => {
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
                        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                            <div className="class-card">
                            <div className="class-card__header">
                              <h3>
                                {tabInfo.assignment.classId}
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
                                              onClick={() => handleMove(tabInfo.assignment.classId, index, -1)}
                                              disabled={index === 0}
                                            >
                                              ↑
                                            </button>
                                            <button
                                              type="button"
                                              className="secondary"
                                              onClick={() =>
                                                handleMove(tabInfo.assignment.classId, index, 1)
                                              }
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
                                  ? `${tabInfo.assignment.classId}（${tabInfo.laneLabel}）のスタートリスト`
                                  : `${tabInfo.assignment.classId} のスタートリスト`}
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
          onClick={handleExportCsv}
          disabled={startTimes.length === 0 || Boolean(loading.startTimes)}
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
