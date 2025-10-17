import { useMemo } from 'react';
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
} from '../state/StartlistContext';
import { calculateStartTimes, updateClassPlayerOrder } from '../utils/startlistUtils';
import type { ClassAssignmentDto } from '@startlist-management/application';

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
  const { classAssignments, startTimes, settings, laneAssignments, entries, statuses } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const entryMap = useMemo(() => {
    return new Map(entries.map((entry) => [entry.id, entry]));
  }, [entries]);

  const startTimeRows = useMemo(() => {
    return startTimes.map((item) => {
      const entry = entryMap.get(item.playerId);
      const isoValue = typeof item.startTime === 'string' ? item.startTime : new Date(item.startTime).toISOString();
      return {
        playerId: item.playerId,
        name: entry?.name ?? '（名前未入力）',
        classId: entry?.classId ?? '不明',
        laneNumber: item.laneNumber,
        startTime: formatStartTime(isoValue),
      };
    });
  }, [startTimes, entryMap]);

  const reorderWithinClass = (classId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }
    const assignment = classAssignments.find((item) => item.classId === classId);
    if (!assignment || toIndex < 0 || toIndex > assignment.playerOrder.length) {
      return;
    }
    const nextAssignments = updateClassPlayerOrder(classAssignments, classId, fromIndex, toIndex);
    updateClassAssignments(dispatch, nextAssignments);
    if (!settings) {
      return;
    }
    const nextStartTimes = calculateStartTimes({
      settings,
      laneAssignments,
      classAssignments: nextAssignments,
      entries,
    });
    updateStartTimes(dispatch, nextStartTimes);
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

  return (
    <section aria-labelledby="step3-heading">
      <header>
        <h2 id="step3-heading">STEP 3 クラス内順序とスタート時間</h2>
        <p className="muted">並び順をドラッグ＆ドロップまたはボタンで変更すると、スタート時間が自動で計算し直されます。スタート時刻はすべて日本時間 (JST) です。</p>
      </header>
      {classAssignments.length === 0 ? (
        <p className="muted">クラス内順序がまだ作成されていません。STEP 2 から進めてください。</p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="class-order-grid">
            {classAssignments.map((assignment) => (
              <div key={assignment.classId} className="class-card">
                <h3>{assignment.classId}</h3>
                {assignment.playerOrder.length === 0 ? (
                  <p className="muted">参加者が登録されていません。</p>
                ) : (
                  <SortableContext
                    items={assignment.playerOrder.map((playerId) => playerItemId(assignment.classId, playerId))}
                    strategy={verticalListSortingStrategy}
                  >
                    <DroppableList assignment={assignment}>
                      {assignment.playerOrder.map((playerId, index) => {
                        const entry = entryMap.get(playerId);
                        return (
                          <ClassPlayerCard key={playerId} classId={assignment.classId} playerId={playerId}>
                            <div className="order-row">
                              <span>
                                {entry?.name || '（名前未入力）'} / {entry?.cardNo ?? playerId}
                              </span>
                              <span className="inline-buttons">
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => handleMove(assignment.classId, index, -1)}
                                  disabled={index === 0}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => handleMove(assignment.classId, index, 1)}
                                  disabled={index === assignment.playerOrder.length - 1}
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
            ))}
          </div>
        </DndContext>
      )}
      <div className="actions-row step-actions">
        <button type="button" className="secondary" onClick={onBack}>
          戻る
        </button>
      </div>
      <StatusMessage tone={statuses.classes.level} message={statuses.classes.text} />
      <StatusMessage tone={statuses.startTimes.level} message={statuses.startTimes.text} />
      {startTimeRows.length > 0 && (
        <div className="table-wrapper">
          <table>
            <caption>スタート時間一覧</caption>
            <thead>
              <tr>
                <th>クラス</th>
                <th>名前 / カード番号</th>
                <th>レーン</th>
                <th>スタート時刻</th>
              </tr>
            </thead>
            <tbody>
              {startTimeRows.map((row) => (
                <tr key={`${row.playerId}-${row.laneNumber}`}>
                  <td>{row.classId}</td>
                  <td>
                    {row.name} / {row.playerId}
                  </td>
                  <td>{row.laneNumber}</td>
                  <td>{row.startTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ClassOrderStep;
